-- Script SQL để hủy thẻ liệu trình và các phiếu trừ buổi, thu hồi hoa hồng nhân viên

DO $$
DECLARE
    v_card_code TEXT := 'T81HD264404';
    v_session_codes TEXT[] := ARRAY['#P33T81HD264404', '#P79T81HD264404'];
    v_package_id UUID;
    v_session_ids UUID[];
BEGIN
    -- 1. Tìm ID thẻ liệu trình dựa trên mã thẻ
    SELECT id INTO v_package_id 
    FROM public.customer_packages 
    WHERE card_code = v_card_code 
    LIMIT 1;

    IF v_package_id IS NULL THEN
        RAISE NOTICE 'Không tìm thấy thẻ liệu trình mã %', v_card_code;
        RETURN;
    END IF;

    -- 2. Tìm các ID của các phiếu trừ buổi
    SELECT array_agg(id) INTO v_session_ids 
    FROM public.service_sessions 
    WHERE session_code = ANY(v_session_codes);

    IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
        -- 3. Xóa hoa hồng của nhân viên làm các buổi này
        DELETE FROM public.commission_logs 
        WHERE service_session_id = ANY(v_session_ids);

        -- 4. Xóa dòng ghi nhận doanh thu (nếu có) của các buổi này
        DELETE FROM public.revenue_logs 
        WHERE service_session_id = ANY(v_session_ids);

        -- 5. Xóa các phiếu trừ buổi
        DELETE FROM public.service_sessions 
        WHERE id = ANY(v_session_ids);
        
        RAISE NOTICE 'Đã xóa % phiếu trừ buổi và thu hồi hoa hồng thành công.', array_length(v_session_ids, 1);
    ELSE
        RAISE NOTICE 'Không tìm thấy các phiếu trừ buổi này (có thể đã bị xóa trước đó).';
    END IF;

    -- 6. Cập nhật lại thẻ liệu trình thành Đã hủy và giảm trừ số buổi đã sử dụng
    UPDATE public.customer_packages 
    SET status = 'cancelled', 
        used_sessions = GREATEST(0, used_sessions - 2)
    WHERE id = v_package_id;

    RAISE NOTICE 'Đã cập nhật trạng thái thẻ % thành Đã hủy.', v_card_code;

END $$;
