-- ==============================================================================
-- MIGRATION: BỔ SUNG CHỌN NHÂN VIÊN DÙNG CHO DOANH SỐ GIẢ LẬP (FAKE REVENUE)
-- Ngày: 2026-09-07
-- Mục đích:
--   1. Cập nhật RLS UPDATE & INSERT cho shop_fake_revenue_configs để Shop Admin 
--      có thể lưu danh sách selected_staff_ids cho Shop của mình.
--   2. Cập nhật RPC public.sp_get_or_create_fake_revenue_day:
--      - KHÔNG FALLBACK: Nếu selected_staff_ids rỗng hoặc không tồn tại,
--        hệ thống coi như CHƯA CẤU HÌNH -> RETURN RỖNG (không sinh fake, không lock).
--      - Khi có selected_staff_ids: Chỉ phân bổ doanh số cho các KTV được chọn.
--      - BẤT BIẾN: Lịch sử các ngày đã LOCK giữ nguyên 100%, không bị ảnh hưởng.
-- ==============================================================================

-- 1. CẬP NHẬT RLS POLICIES CHO public.shop_fake_revenue_configs
-- Cho phép Shop Admin / authenticated member cấu hình cho chính Shop của mình
DROP POLICY IF EXISTS shop_fake_revenue_configs_insert_policy ON public.shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_insert_policy 
ON public.shop_fake_revenue_configs 
FOR INSERT 
TO authenticated 
WITH CHECK (
    shop_id = public.auth_user_shop_id() 
    OR public.is_super_admin()
);

DROP POLICY IF EXISTS shop_fake_revenue_configs_update_policy ON public.shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_update_policy 
ON public.shop_fake_revenue_configs 
FOR UPDATE 
TO authenticated 
USING (
    shop_id = public.auth_user_shop_id() 
    OR public.is_super_admin()
)
WITH CHECK (
    shop_id = public.auth_user_shop_id() 
    OR public.is_super_admin()
);

-- 2. CẬP NHẬT RPC: sp_get_or_create_fake_revenue_day
DROP FUNCTION IF EXISTS public.sp_get_or_create_fake_revenue_day(UUID, DATE);

CREATE OR REPLACE FUNCTION public.sp_get_or_create_fake_revenue_day(
    p_shop_id UUID,
    p_revenue_date DATE
)
RETURNS TABLE (
    id UUID,
    shop_id UUID,
    revenue_date DATE,
    staff_id UUID,
    technician_name_snapshot TEXT,
    service_id UUID,
    service_name_snapshot TEXT,
    quantity INTEGER,
    unit_price NUMERIC,
    amount NUMERIC,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v_today DATE;
    v_lock_id UUID;
    v_config RECORD;
    v_day_key TEXT;
    v_base_val NUMERIC;
    v_hash_hex TEXT;
    v_hash_int BIGINT;
    v_var_pct NUMERIC;
    v_ratio NUMERIC;
    v_raw_target NUMERIC;
    v_target_total NUMERIC;
    v_daily_total NUMERIC;
    v_staff_count INT;
    v_service_count INT;
    v_target_item_count INT;
    v_current_sum NUMERIC;
    v_item_idx INT;
    
    selected_svc_indices INT[] := ARRAY[]::INT[];
    selected_staff_indices INT[] := ARRAY[]::INT[];

    staff_perm INT[] := ARRAY[]::INT[];
    v_shuf_j INT;
    v_shuf_swap INT;
    v_shuf_temp INT;

    arr_staff_ids UUID[];
    arr_staff_names TEXT[];
    arr_service_ids UUID[];
    arr_service_names TEXT[];
    arr_service_prices NUMERIC[];
BEGIN
    -- 1. BẢO VỆ MULTI-TENANT: Chặn truy cập chéo shop
    IF NOT public.is_super_admin() THEN
        IF p_shop_id IS NULL OR p_shop_id != public.auth_user_shop_id() THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: shop_id không hợp lệ hoặc bạn không thuộc cửa hàng này.';
        END IF;
    END IF;

    -- 2. KHÓA GIAO DỊCH ADVISORY LOCK THEO CẶP (shop_id, revenue_date)
    PERFORM pg_advisory_xact_lock(hashtext(p_shop_id::text || '_' || p_revenue_date::text));

    -- Lấy ngày hôm nay theo múi giờ Việt Nam (GMT+7)
    v_today := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

    -- 3. QUY TẮC AN TOÀN: Hôm nay và tương lai tuyệt đối không sinh fake
    IF p_revenue_date >= v_today THEN
        RETURN;
    END IF;

    -- 4. KIỂM TRA LỊCH SỬ ĐÃ KHÓA CHƯA (HISTORY LOCKED)
    -- Lịch sử đã khóa là BẤT BIẾN: Trả về dữ liệu cũ ngay lập tức, không thay đổi
    SELECT l.id INTO v_lock_id 
    FROM public.shop_fake_daily_locks l 
    WHERE l.shop_id = p_shop_id AND l.revenue_date = p_revenue_date;

    IF v_lock_id IS NOT NULL THEN
        RETURN QUERY
        SELECT r.id, r.shop_id, r.revenue_date, r.staff_id, r.technician_name_snapshot,
               r.service_id, r.service_name_snapshot, r.quantity, r.unit_price, r.amount, r.created_at
        FROM public.fake_revenue_records r
        WHERE r.daily_lock_id = v_lock_id
        ORDER BY r.created_at ASC;
        RETURN;
    END IF;

    -- 5. KIỂM TRA CẤU HÌNH SHOP & MỐC FAKE_START_DATE
    SELECT * INTO v_config 
    FROM public.shop_fake_revenue_configs 
    WHERE public.shop_fake_revenue_configs.shop_id = p_shop_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF p_revenue_date < v_config.fake_start_date THEN
        RETURN;
    END IF;

    -- 6. LẤY BASE LEVEL THEO NGÀY TRONG THÁNG (1 -> 31)
    v_day_key := EXTRACT(DAY FROM p_revenue_date)::TEXT;
    v_base_val := COALESCE((v_config.base_config->>v_day_key)::NUMERIC, 0);

    IF v_base_val <= 0 THEN
        RETURN;
    END IF;

    -- 7. KIỂM TRA & NẠP DANH SÁCH NHÂN VIÊN ĐƯỢC CHỌN (TUYỆT ĐỐI KHÔNG FALLBACK)
    IF NOT (v_config.base_config ? 'selected_staff_ids') 
       OR jsonb_typeof(v_config.base_config->'selected_staff_ids') != 'array'
       OR jsonb_array_length(v_config.base_config->'selected_staff_ids') = 0 THEN
        RETURN;
    END IF;

    -- Chỉ lọc các nhân viên thực sự nằm trong danh sách selected_staff_ids và đang hoạt động
    SELECT array_agg(st.id), array_agg(st.full_name)
    INTO arr_staff_ids, arr_staff_names
    FROM public.staffs st
    WHERE st.shop_id = p_shop_id 
      AND st.status != 'inactive'
      AND (st.deleted_at IS NULL)
      AND st.id IN (
          SELECT val::UUID
          FROM jsonb_array_elements_text(v_config.base_config->'selected_staff_ids') AS val
          WHERE val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      );

    -- Nạp danh mục dịch vụ thật có đơn giá niêm yết > 0
    SELECT array_agg(sv.id), array_agg(sv.name), array_agg(sv.price)
    INTO arr_service_ids, arr_service_names, arr_service_prices
    FROM public.services sv
    WHERE sv.shop_id = p_shop_id 
      AND sv.status != 'inactive'
      AND (sv.deleted_at IS NULL)
      AND COALESCE(sv.price, 0) > 0;

    v_staff_count := COALESCE(array_length(arr_staff_ids, 1), 0);
    v_service_count := COALESCE(array_length(arr_service_ids, 1), 0);

    IF v_staff_count = 0 OR v_service_count = 0 THEN
        RETURN;
    END IF;

    -- 8. TÍNH TOÁN TARGET DOANH THU CỦA NGÀY (CÓ DAO ĐỘNG QUANH MỨC BASE)
    v_hash_hex := md5(p_shop_id::text || '_' || p_revenue_date::text);
    v_hash_int := ('x' || substr(v_hash_hex, 1, 8))::bit(32)::bigint;

    v_var_pct := COALESCE(v_config.variation_percent, 10);
    IF v_var_pct < 1 THEN v_var_pct := 10; END IF;

    v_ratio := 1.0 + ((abs(v_hash_int) % (v_var_pct * 2 + 1) - v_var_pct)::NUMERIC / 100.0);
    v_raw_target := v_base_val * v_ratio;
    v_target_total := ROUND(v_raw_target / 10000.0) * 10000;
    IF v_target_total <= 0 THEN v_target_total := 10000; END IF;

    -- 9. THIẾT LẬP THỨ TỰ KTV THEO TOUR XOAY VÒNG (ROUND-ROBIN VỚI SHUFFLE THEO NGÀY)
    -- Đảm bảo 100%: Các nhân viên được chia đều số ca làm việc, chênh lệch tối đa 1 ca!
    staff_perm := ARRAY[]::INT[];
    FOR v_shuf_j IN 1..v_staff_count LOOP
        staff_perm := array_append(staff_perm, v_shuf_j);
    END LOOP;
    
    FOR v_shuf_j IN REVERSE v_staff_count..2 LOOP
        v_shuf_swap := 1 + (abs(('x' || substr(md5(v_hash_hex || '_shuf_' || v_shuf_j::text), 1, 8))::bit(32)::bigint) % v_shuf_j);
        v_shuf_temp := staff_perm[v_shuf_j];
        staff_perm[v_shuf_j] := staff_perm[v_shuf_swap];
        staff_perm[v_shuf_swap] := v_shuf_temp;
    END LOOP;

    -- 10. CHỌN TỔ HỢP DỊCH VỤ THẬT THEO ĐÚNG ĐƠN GIÁ NIÊM YẾT MENU (services.price)
    -- ĐẢM BẢO TUYỆT ĐỐI: Cùng một dịch vụ luôn có đơn giá hoàn toàn giống nhau!
    v_current_sum := 0;
    v_item_idx := 0;

    WHILE v_current_sum < v_target_total AND v_item_idx < 50 LOOP
        DECLARE
            candidate_indices INT[] := ARRAY[]::INT[];
            c_idx INT;
            chosen_svc_idx INT;
            chosen_staff_idx INT;
            chosen_price NUMERIC;
        BEGIN
            FOR c_idx IN 1..v_service_count LOOP
                IF arr_service_prices[c_idx] <= (v_target_total - v_current_sum) THEN
                    candidate_indices := array_append(candidate_indices, c_idx);
                END IF;
            END LOOP;

            -- Nếu không còn dịch vụ nào có giá <= số tiền còn thiếu:
            IF COALESCE(array_length(candidate_indices, 1), 0) = 0 THEN
                IF v_item_idx = 0 THEN
                    -- Nếu chưa có ca nào thì lấy dịch vụ rẻ nhất
                    chosen_svc_idx := 1;
                    FOR c_idx IN 2..v_service_count LOOP
                        IF arr_service_prices[c_idx] < arr_service_prices[chosen_svc_idx] THEN
                            chosen_svc_idx := c_idx;
                        END IF;
                    END LOOP;
                    
                    v_item_idx := 1;
                    chosen_staff_idx := staff_perm[1 + ((v_item_idx - 1) % v_staff_count)];
                    chosen_price := arr_service_prices[chosen_svc_idx];
                    v_current_sum := chosen_price;
                    
                    selected_svc_indices := array_append(selected_svc_indices, chosen_svc_idx);
                    selected_staff_indices := array_append(selected_staff_indices, chosen_staff_idx);
                END IF;
                EXIT;
            END IF;

            v_item_idx := v_item_idx + 1;
            chosen_svc_idx := candidate_indices[1 + (abs(('x' || substr(md5(v_hash_hex || '_svc_' || v_item_idx::text), 1, 8))::bit(32)::bigint) % array_length(candidate_indices, 1))];
            chosen_staff_idx := staff_perm[1 + ((v_item_idx - 1) % v_staff_count)];
            
            chosen_price := arr_service_prices[chosen_svc_idx];
            v_current_sum := v_current_sum + chosen_price;

            selected_svc_indices := array_append(selected_svc_indices, chosen_svc_idx);
            selected_staff_indices := array_append(selected_staff_indices, chosen_staff_idx);
        END;
    END LOOP;

    v_daily_total := v_current_sum;
    v_target_item_count := array_length(selected_svc_indices, 1);

    -- 10. TẠO BẢN GHI KHÓA NGÀY (ATOMIC & IDEMPOTENT)
    INSERT INTO public.shop_fake_daily_locks (shop_id, revenue_date, base_amount, generated_total, item_count)
    VALUES (p_shop_id, p_revenue_date, v_base_val, v_daily_total, v_target_item_count)
    ON CONFLICT (shop_id, revenue_date) DO NOTHING
    RETURNING public.shop_fake_daily_locks.id INTO v_lock_id;

    IF v_lock_id IS NULL THEN
        SELECT l.id INTO v_lock_id FROM public.shop_fake_daily_locks l WHERE l.shop_id = p_shop_id AND l.revenue_date = p_revenue_date;
        RETURN QUERY
        SELECT r.id, r.shop_id, r.revenue_date, r.staff_id, r.technician_name_snapshot,
               r.service_id, r.service_name_snapshot, r.quantity, r.unit_price, r.amount, r.created_at
        FROM public.fake_revenue_records r
        WHERE r.daily_lock_id = v_lock_id
        ORDER BY r.created_at ASC;
        RETURN;
    END IF;

    -- 11. GHI CÁC BẢN GHI FAKE REVENUE VỚI ĐƠN GIÁ CHUẨN MENU & KTV ĐÃ CHỌN
    FOR v_item_idx IN 1..v_target_item_count LOOP
        DECLARE
            svc_i INT := selected_svc_indices[v_item_idx];
            tech_i INT := selected_staff_indices[v_item_idx];
            item_price NUMERIC := arr_service_prices[svc_i];
        BEGIN
            INSERT INTO public.fake_revenue_records (
                shop_id, daily_lock_id, revenue_date, 
                staff_id, technician_name_snapshot,
                service_id, service_name_snapshot,
                quantity, unit_price, amount
            ) VALUES (
                p_shop_id, v_lock_id, p_revenue_date,
                arr_staff_ids[tech_i], arr_staff_names[tech_i],
                arr_service_ids[svc_i], arr_service_names[svc_i],
                1, item_price, item_price
            );
        END;
    END LOOP;

    -- 12. TRẢ VỀ TOÀN BỘ BẢN GHI ĐÃ SINH VÀ ĐÃ KHÓA
    RETURN QUERY
    SELECT r.id, r.shop_id, r.revenue_date, r.staff_id, r.technician_name_snapshot,
           r.service_id, r.service_name_snapshot, r.quantity, r.unit_price, r.amount, r.created_at
    FROM public.fake_revenue_records r
    WHERE r.daily_lock_id = v_lock_id
    ORDER BY r.created_at ASC;

END;
$$;

-- 3. ĐẢM BẢO QUYỀN THỰC THI & RLS
GRANT EXECUTE ON FUNCTION public.sp_get_or_create_fake_revenue_day(UUID, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
