-- ==============================================================================
-- Migration: Hệ thống Doanh số Lịch sử Ảo theo Ngày (Fake Revenue History System)
-- Mục đích: 
--   1. Lưu cấu hình 31 ngày BASE & fake_start_date của từng Shop (shop_fake_revenue_configs)
--   2. Khóa ngày và đảm bảo Idempotency tuyệt đối (shop_fake_daily_locks)
--   3. Lưu chi tiết KTV & Dịch vụ ảo khớp 100% tổng ngày (fake_revenue_records)
--   4. PostgreSQL RPC sp_get_or_create_fake_revenue_day: Single Source of Truth
-- ==============================================================================

-- 1. Bảng cấu hình doanh số giả định theo Shop
CREATE TABLE IF NOT EXISTS shop_fake_revenue_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    fake_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    base_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    variation_percent INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT shop_fake_revenue_configs_shop_id_key UNIQUE (shop_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_fake_revenue_configs_shop_id 
ON shop_fake_revenue_configs(shop_id);

COMMENT ON TABLE shop_fake_revenue_configs IS 'Lưu 31 mức BASE và ngày bắt đầu sinh fake của từng shop do Super Admin thiết lập';
COMMENT ON COLUMN shop_fake_revenue_configs.base_config IS 'Object JSON dạng {"1": 5000000, "2": 5500000, ..., "31": 7000000}';
COMMENT ON COLUMN shop_fake_revenue_configs.fake_start_date IS 'Ngày bắt đầu áp dụng sinh fake; trước ngày này doanh số = 0';

-- 2. Bảng Khóa Ngày & Tổng Ngày (Đảm bảo Idempotency & Tránh Race Condition)
CREATE TABLE IF NOT EXISTS shop_fake_daily_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    revenue_date DATE NOT NULL,
    base_amount NUMERIC NOT NULL DEFAULT 0,
    generated_total NUMERIC NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_shop_fake_daily_locks UNIQUE (shop_id, revenue_date)
);

CREATE INDEX IF NOT EXISTS idx_shop_fake_daily_locks_lookup 
ON shop_fake_daily_locks(shop_id, revenue_date);

COMMENT ON TABLE shop_fake_daily_locks IS 'Khóa vĩnh viễn dữ liệu doanh số ảo của 1 shop trong 1 ngày, chống duplicate';

-- 3. Bảng Chi tiết Kỹ thuật viên & Dịch vụ ảo (Lịch sử chi tiết)
CREATE TABLE IF NOT EXISTS fake_revenue_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    daily_lock_id UUID NOT NULL REFERENCES shop_fake_daily_locks(id) ON DELETE CASCADE,
    revenue_date DATE NOT NULL,
    staff_id UUID REFERENCES staffs(id) ON DELETE SET NULL,
    technician_name_snapshot TEXT NOT NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    service_name_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fake_revenue_records_shop_date 
ON fake_revenue_records(shop_id, revenue_date);

CREATE INDEX IF NOT EXISTS idx_fake_revenue_records_lock_id 
ON fake_revenue_records(daily_lock_id);

COMMENT ON TABLE fake_revenue_records IS 'Lưu chi tiết từng lượt dịch vụ ảo với snapshot tên KTV & dịch vụ khớp 100% tổng ngày';

-- 4. Kích hoạt Row Level Security (RLS)
ALTER TABLE shop_fake_revenue_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_fake_daily_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fake_revenue_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE shop_fake_revenue_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_fake_daily_locks FORCE ROW LEVEL SECURITY;
ALTER TABLE fake_revenue_records FORCE ROW LEVEL SECURITY;

-- 5. RLS Policies: shop_fake_revenue_configs
DROP POLICY IF EXISTS shop_fake_revenue_configs_select_policy ON shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_select_policy ON shop_fake_revenue_configs 
FOR SELECT TO authenticated 
USING (shop_id = auth_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS shop_fake_revenue_configs_insert_policy ON shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_insert_policy ON shop_fake_revenue_configs 
FOR INSERT TO authenticated 
WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS shop_fake_revenue_configs_update_policy ON shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_update_policy ON shop_fake_revenue_configs 
FOR UPDATE TO authenticated 
USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS shop_fake_revenue_configs_delete_policy ON shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_delete_policy ON shop_fake_revenue_configs 
FOR DELETE TO authenticated 
USING (is_super_admin());

-- 6. RLS Policies: shop_fake_daily_locks & fake_revenue_records
DROP POLICY IF EXISTS shop_fake_daily_locks_select ON shop_fake_daily_locks;
CREATE POLICY shop_fake_daily_locks_select ON shop_fake_daily_locks 
FOR SELECT TO authenticated 
USING (shop_id = auth_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS shop_fake_daily_locks_all ON shop_fake_daily_locks;
CREATE POLICY shop_fake_daily_locks_all ON shop_fake_daily_locks 
FOR ALL TO authenticated 
USING (shop_id = auth_user_shop_id() OR is_super_admin())
WITH CHECK (shop_id = auth_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS fake_revenue_records_select ON fake_revenue_records;
CREATE POLICY fake_revenue_records_select ON fake_revenue_records 
FOR SELECT TO authenticated 
USING (shop_id = auth_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS fake_revenue_records_all ON fake_revenue_records;
CREATE POLICY fake_revenue_records_all ON fake_revenue_records 
FOR ALL TO authenticated 
USING (shop_id = auth_user_shop_id() OR is_super_admin())
WITH CHECK (shop_id = auth_user_shop_id() OR is_super_admin());

-- 7. Trigger tự động cập nhật updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_shop_fake_revenue_configs_updated_at') THEN
        CREATE FUNCTION update_shop_fake_revenue_configs_updated_at()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_shop_fake_revenue_configs_updated_at ON shop_fake_revenue_configs;
CREATE TRIGGER trg_shop_fake_revenue_configs_updated_at
BEFORE UPDATE ON shop_fake_revenue_configs
FOR EACH ROW
EXECUTE FUNCTION update_shop_fake_revenue_configs_updated_at();

-- ==============================================================================
-- 8. POSTGRESQL RPC: sp_get_or_create_fake_revenue_day
-- Đóng vai trò Single Source of Truth cho cả POSA Desktop và Web App
-- Đảm bảo Transaction, Idempotency, Khớp tổng 100%, Tròn 10.000 VNĐ
-- ==============================================================================
CREATE OR REPLACE FUNCTION sp_get_or_create_fake_revenue_day(
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
    v_daily_total NUMERIC;
    v_staff_count INT;
    v_service_count INT;
    v_target_item_count INT;
    v_allocated_sum NUMERIC := 0;
    v_diff NUMERIC;
    v_item_idx INT;
    v_cur_staff_id UUID;
    v_cur_staff_name TEXT;
    v_cur_service_id UUID;
    v_cur_service_name TEXT;
    v_cur_price NUMERIC;
    v_cur_amount NUMERIC;
    v_last_record_id UUID;
    
    -- Danh sách mảng tạm
    arr_staff_ids UUID[];
    arr_staff_names TEXT[];
    arr_service_ids UUID[];
    arr_service_names TEXT[];
    arr_service_prices NUMERIC[];
BEGIN
    -- BẢO VỆ MULTI-TENANT: Không tin tưởng mù quáng vào p_shop_id từ client
    IF NOT is_super_admin() THEN
        IF p_shop_id IS NULL OR p_shop_id != auth_user_shop_id() THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: shop_id không hợp lệ hoặc bạn không thuộc cửa hàng này.';
        END IF;
    END IF;

    -- KHÓA GIAO DỊCH ADVISORY LOCK THEO CẶP (shop_id, revenue_date)
    -- Đảm bảo tuyệt đối: Khi Web App và POSA cùng mở 1 ngày chưa có dữ liệu tại cùng 1 microsecond,
    -- request thứ 2 sẽ chờ request thứ 1 commit xong rồi đọc ngay kết quả đã khóa, triệt tiêu 100% race condition.
    PERFORM pg_advisory_xact_lock(hashtext(p_shop_id::text || '_' || p_revenue_date::text));

    -- Lấy ngày hôm nay theo múi giờ Việt Nam (GMT+7)
    v_today := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

    -- QUY TẮC: Hôm nay và tương lai không sinh fake
    IF p_revenue_date >= v_today THEN
        RETURN;
    END IF;

    -- BƯỚC 1: KIỂM TRA XEM NGÀY NÀY ĐÃ ĐƯỢC KHÓA CHƯA (HISTORY LOCKED)
    SELECT l.id INTO v_lock_id 
    FROM shop_fake_daily_locks l 
    WHERE l.shop_id = p_shop_id AND l.revenue_date = p_revenue_date;

    IF v_lock_id IS NOT NULL THEN
        -- Đã có dữ liệu chốt: Trả về trực tiếp, vĩnh viễn không sinh lại
        RETURN QUERY
        SELECT r.id, r.shop_id, r.revenue_date, r.staff_id, r.technician_name_snapshot,
               r.service_id, r.service_name_snapshot, r.quantity, r.unit_price, r.amount, r.created_at
        FROM fake_revenue_records r
        WHERE r.daily_lock_id = v_lock_id
        ORDER BY r.created_at ASC;
        RETURN;
    END IF;

    -- BƯỚC 2: KIỂM TRA CẤU HÌNH SHOP & FAKE_START_DATE
    SELECT * INTO v_config 
    FROM shop_fake_revenue_configs 
    WHERE shop_fake_revenue_configs.shop_id = p_shop_id;

    IF NOT FOUND THEN
        RETURN; -- Chưa cấu hình -> Không sinh
    END IF;

    IF p_revenue_date < v_config.fake_start_date THEN
        RETURN; -- Trước fake_start_date -> Không sinh
    END IF;

    -- BƯỚC 3: LẤY BASE LEVEL THEO NGÀY TRONG THÁNG (1 -> 31)
    v_day_key := EXTRACT(DAY FROM p_revenue_date)::TEXT;
    v_base_val := COALESCE((v_config.base_config->>v_day_key)::NUMERIC, 0);

    IF v_base_val <= 0 THEN
        RETURN; -- BASE = 0 -> Không sinh
    END IF;

    -- BƯỚC 4: DETERMINISTIC PRNG TỪ (shop_id + revenue_date)
    -- Sử dụng MD5 băm chuỗi để sinh số giả ngẫu nhiên có tính xác định tuyệt đối (Không dùng Math.random)
    v_hash_hex := md5(p_shop_id::text || '_' || p_revenue_date::text);
    v_hash_int := ('x' || substr(v_hash_hex, 1, 8))::bit(32)::bigint;

    v_var_pct := COALESCE(v_config.variation_percent, 10);
    IF v_var_pct < 1 THEN v_var_pct := 10; END IF;

    -- Dao động trong khoảng [-v_var_pct, +v_var_pct] %
    v_ratio := 1.0 + ((abs(v_hash_int) % (v_var_pct * 2 + 1) - v_var_pct)::NUMERIC / 100.0);
    v_raw_target := v_base_val * v_ratio;

    -- BẮT BUỘC: LÀM TRÒN VỀ BỘI SỐ CỦA 10.000 VNĐ
    v_daily_total := ROUND(v_raw_target / 10000.0) * 10000;
    IF v_daily_total <= 0 THEN v_daily_total := 10000; END IF;

    -- BƯỚC 5: NẠP DỮ LIỆU KTV THẬT & DỊCH VỤ THẬT CỦA SHOP
    SELECT array_agg(st.id), array_agg(st.full_name)
    INTO arr_staff_ids, arr_staff_names
    FROM staffs st
    WHERE st.shop_id = p_shop_id AND st.status != 'inactive';

    SELECT array_agg(sv.id), array_agg(sv.name), array_agg(COALESCE(sv.price, 0))
    INTO arr_service_ids, arr_service_names, arr_service_prices
    FROM services sv
    WHERE sv.shop_id = p_shop_id AND sv.status != 'inactive';

    v_staff_count := COALESCE(array_length(arr_staff_ids, 1), 0);
    v_service_count := COALESCE(array_length(arr_service_ids, 1), 0);

    -- Fallback nếu shop chưa tạo KTV hoặc dịch vụ
    IF v_staff_count = 0 THEN
        arr_staff_ids := ARRAY[NULL::UUID];
        arr_staff_names := ARRAY['Kỹ thuật viên 1'];
        v_staff_count := 1;
    END IF;

    IF v_service_count = 0 THEN
        arr_service_ids := ARRAY[NULL::UUID];
        arr_service_names := ARRAY['Chăm sóc da chuyên sâu'];
        arr_service_prices := ARRAY[350000::NUMERIC];
        v_service_count := 1;
    END IF;

    -- BƯỚC 6: TẠO BẢN GHI KHÓA NGÀY (DAILY LOCK)
    -- Sử dụng ON CONFLICT DO NOTHING để xử lý triệt để race condition khi 2 client cùng gọi
    INSERT INTO shop_fake_daily_locks (shop_id, revenue_date, base_amount, generated_total, item_count)
    VALUES (p_shop_id, p_revenue_date, v_base_val, v_daily_total, 0)
    ON CONFLICT (shop_id, revenue_date) DO NOTHING
    RETURNING shop_fake_daily_locks.id INTO v_lock_id;

    -- Nếu lock_id là NULL nghĩa là 1 request song song vừa tạo xong trong tích tắc
    IF v_lock_id IS NULL THEN
        SELECT l.id INTO v_lock_id FROM shop_fake_daily_locks l WHERE l.shop_id = p_shop_id AND l.revenue_date = p_revenue_date;
        RETURN QUERY
        SELECT r.id, r.shop_id, r.revenue_date, r.staff_id, r.technician_name_snapshot,
               r.service_id, r.service_name_snapshot, r.quantity, r.unit_price, r.amount, r.created_at
        FROM fake_revenue_records r
        WHERE r.daily_lock_id = v_lock_id
        ORDER BY r.created_at ASC;
        RETURN;
    END IF;

    -- BƯỚC 7: PHÂN BỔ CA DỊCH VỤ & KỸ THUẬT VIÊN
    -- Số lượng ca phân bổ dựa trên quy mô doanh số (từ 3 đến 8 ca)
    v_target_item_count := 3 + (abs(v_hash_int >> 4) % 6); -- 3..8 ca
    IF v_target_item_count > 10 THEN v_target_item_count := 6; END IF;

    FOR v_item_idx IN 1..v_target_item_count LOOP
        -- Chọn KTV theo PRNG
        DECLARE
            tech_idx INT := 1 + (abs(('x' || substr(md5(v_hash_hex || '_tech_' || v_item_idx::text), 1, 8))::bit(32)::bigint) % v_staff_count);
            svc_idx INT := 1 + (abs(('x' || substr(md5(v_hash_hex || '_svc_' || v_item_idx::text), 1, 8))::bit(32)::bigint) % v_service_count);
            item_hash BIGINT := abs(('x' || substr(md5(v_hash_hex || '_amt_' || v_item_idx::text), 1, 8))::bit(32)::bigint);
            raw_item_amt NUMERIC;
        BEGIN
            v_cur_staff_id := arr_staff_ids[tech_idx];
            v_cur_staff_name := arr_staff_names[tech_idx];
            v_cur_service_id := arr_service_ids[svc_idx];
            v_cur_service_name := arr_service_names[svc_idx];
            v_cur_price := arr_service_prices[svc_idx];

            IF v_cur_price <= 0 THEN v_cur_price := 250000; END IF;

            -- Tính ước tính số tiền cho mỗi ca
            IF v_item_idx < v_target_item_count THEN
                raw_item_amt := (v_daily_total / v_target_item_count::NUMERIC) * (0.8 + ((item_hash % 41)::NUMERIC / 100.0));
                v_cur_amount := ROUND(raw_item_amt / 10000.0) * 10000;
                IF v_cur_amount <= 0 THEN v_cur_amount := 10000; END IF;
                
                -- Không để phân bổ vượt quá tổng
                IF (v_allocated_sum + v_cur_amount) >= v_daily_total THEN
                    v_cur_amount := v_daily_total - v_allocated_sum;
                    IF v_cur_amount <= 0 THEN v_cur_amount := 10000; END IF;
                END IF;
            ELSE
                -- Dòng cuối cùng: RECONCILE KHỚP CHÍNH XÁC 100%
                v_cur_amount := v_daily_total - v_allocated_sum;
                IF v_cur_amount <= 0 THEN
                    v_cur_amount := 10000;
                END IF;
            END IF;

            v_allocated_sum := v_allocated_sum + v_cur_amount;

            -- INSERT vào bảng fake_revenue_records
            INSERT INTO fake_revenue_records (
                shop_id, daily_lock_id, revenue_date, 
                staff_id, technician_name_snapshot,
                service_id, service_name_snapshot,
                quantity, unit_price, amount
            ) VALUES (
                p_shop_id, v_lock_id, p_revenue_date,
                v_cur_staff_id, v_cur_staff_name,
                v_cur_service_id, v_cur_service_name,
                1, v_cur_amount, v_cur_amount
            ) RETURNING fake_revenue_records.id INTO v_last_record_id;

        END;
    END LOOP;

    -- BƯỚC 8: BÙ TRỪ LẦN CUỐI NẾU CÓ CHÊNH LỆCH VỚI GENERATED_DAILY_TOTAL
    v_diff := v_daily_total - (SELECT COALESCE(SUM(r.amount), 0) FROM fake_revenue_records r WHERE r.daily_lock_id = v_lock_id);
    IF v_diff != 0 AND v_last_record_id IS NOT NULL THEN
        UPDATE fake_revenue_records 
        SET amount = amount + v_diff, unit_price = amount + v_diff
        WHERE fake_revenue_records.id = v_last_record_id;
    END IF;

    -- Cập nhật số lượng items thực tế vào shop_fake_daily_locks
    UPDATE shop_fake_daily_locks 
    SET item_count = (SELECT COUNT(*)::INT FROM fake_revenue_records r WHERE r.daily_lock_id = v_lock_id),
        generated_total = (SELECT COALESCE(SUM(r.amount), 0) FROM fake_revenue_records r WHERE r.daily_lock_id = v_lock_id)
    WHERE shop_fake_daily_locks.id = v_lock_id;

    -- BƯỚC 9: TRẢ VỀ TOÀN BỘ BẢN GHI ĐÃ SINH VÀ ĐÃ KHÓA
    RETURN QUERY
    SELECT r.id, r.shop_id, r.revenue_date, r.staff_id, r.technician_name_snapshot,
           r.service_id, r.service_name_snapshot, r.quantity, r.unit_price, r.amount, r.created_at
    FROM fake_revenue_records r
    WHERE r.daily_lock_id = v_lock_id
    ORDER BY r.created_at ASC;

END;
$$;

-- 9. Phân quyền thực thi và truy cập cho vai trò authenticated (Supabase)
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_fake_revenue_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_fake_daily_locks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fake_revenue_records TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_or_create_fake_revenue_day(UUID, DATE) TO authenticated;

-- Cập nhật schema cache của PostgREST
NOTIFY pgrst, 'reload schema';
