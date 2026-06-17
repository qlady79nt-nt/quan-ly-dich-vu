-- Script SQL để copy toàn bộ chức năng (gói dịch vụ) và quyền hạn từ cửa hàng SPA-9OIFRM sang SPA-3XG6Z1

DO $$
DECLARE
    source_shop_id UUID;
    target_shop_id UUID;
    source_plan_id UUID;
BEGIN
    -- 1. Lấy thông tin cửa hàng gốc (SPA-9OIFRM)
    SELECT id, plan_id INTO source_shop_id, source_plan_id 
    FROM public.shops 
    WHERE shop_code = 'SPA-9OIFRM' 
    LIMIT 1;

    -- 2. Lấy thông tin cửa hàng đích (SPA-3XG6Z1)
    SELECT id INTO target_shop_id 
    FROM public.shops 
    WHERE shop_code = 'SPA-3XG6Z1' 
    LIMIT 1;

    IF source_shop_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy cửa hàng gốc SPA-9OIFRM';
    END IF;
    
    IF target_shop_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy cửa hàng đích SPA-3XG6Z1';
    END IF;

    -- 3. Đồng bộ gói dịch vụ (Plan - Chức năng hệ thống)
    UPDATE public.shops 
    SET plan_id = source_plan_id 
    WHERE id = target_shop_id;

    -- 4. Copy toàn bộ user_permissions từ Quản lý (shop_admin) của cửa hàng gốc sang Quản lý của cửa hàng đích
    -- Điều này sẽ giúp cửa hàng mới có đầy đủ các quyền xem báo cáo, doanh thu, hoa hồng KTV
    INSERT INTO public.user_permissions (user_id, permission)
    SELECT DISTINCT p_target.id, up.permission
    FROM public.user_permissions up
    JOIN public.profiles p_source ON up.user_id = p_source.id
    CROSS JOIN public.profiles p_target
    WHERE p_source.shop_id = source_shop_id 
      AND p_source.role = 'shop_admin'
      AND p_target.shop_id = target_shop_id 
      AND p_target.role = 'shop_admin'
      AND NOT EXISTS (
          -- Đảm bảo không insert trùng quyền đã có
          SELECT 1 FROM public.user_permissions target_up 
          WHERE target_up.user_id = p_target.id 
          AND target_up.permission = up.permission
      );

    -- 5. Đảm bảo ít nhất 1 tài khoản của cửa hàng SPA-3XG6Z1 được nâng cấp lên 'shop_admin'
    -- (Trong trường hợp cửa hàng này chỉ toàn nhân viên 'staff' nên không thấy được tab Báo Cáo và KTV)
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE shop_id = target_shop_id AND role = 'shop_admin') THEN
        -- Lấy profile đầu tiên được tạo (thường là chủ shop) và nâng cấp lên quản lý
        UPDATE public.profiles 
        SET role = 'shop_admin' 
        WHERE id = (
            SELECT id FROM public.profiles 
            WHERE shop_id = target_shop_id 
            ORDER BY created_at ASC 
            LIMIT 1
        );
    END IF;

END $$;
