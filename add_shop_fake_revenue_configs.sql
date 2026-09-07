-- ==============================================================================
-- Migration: Tạo bảng shop_fake_revenue_configs
-- Mục đích: Lưu trữ cấu hình doanh số giả định 31 ngày cho từng Shop
-- Quyền hạn:
--   - Super Admin: Toàn quyền (SELECT, INSERT, UPDATE, DELETE)
--   - Shop Member (Shop Admin / Staff): Chỉ có quyền xem (SELECT) cấu hình của Shop mình
-- ==============================================================================

-- 1. Tạo bảng shop_fake_revenue_configs
CREATE TABLE IF NOT EXISTS shop_fake_revenue_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT shop_fake_revenue_configs_shop_id_key UNIQUE (shop_id)
);

-- Tạo index tìm kiếm theo shop_id
CREATE INDEX IF NOT EXISTS idx_shop_fake_revenue_configs_shop_id 
ON shop_fake_revenue_configs(shop_id);

-- Ghi chú cho bảng và cột
COMMENT ON TABLE shop_fake_revenue_configs IS 'Lưu cấu hình doanh số giả định 31 ngày của từng shop do Super Admin thiết lập';
COMMENT ON COLUMN shop_fake_revenue_configs.shop_id IS 'Mã cửa hàng (duy nhất - 1 shop có 1 bản ghi cấu hình)';
COMMENT ON COLUMN shop_fake_revenue_configs.config IS 'Object JSON dạng {"1": 5500000, "2": 6200000, ..., "31": 7000000} đại diện số tiền theo ngày trong tháng';

-- 2. Kích hoạt Row Level Security (RLS)
ALTER TABLE shop_fake_revenue_configs ENABLE ROW LEVEL SECURITY;

-- 3. Chính sách SELECT:
-- - Nhân viên/Admin thuộc Shop chỉ được đọc cấu hình của Shop mình (dựa vào auth_user_shop_id())
-- - Super Admin có thể đọc cấu hình của tất cả các Shop (dựa vào is_super_admin())
DROP POLICY IF EXISTS shop_fake_revenue_configs_select_policy ON shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_select_policy 
ON shop_fake_revenue_configs 
FOR SELECT 
TO authenticated 
USING (
    shop_id = auth_user_shop_id() 
    OR is_super_admin()
);

-- 4. Chính sách INSERT:
-- - CHỈ Super Admin được phép thêm cấu hình
DROP POLICY IF EXISTS shop_fake_revenue_configs_insert_policy ON shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_insert_policy 
ON shop_fake_revenue_configs 
FOR INSERT 
TO authenticated 
WITH CHECK (
    is_super_admin()
);

-- 5. Chính sách UPDATE:
-- - CHỈ Super Admin được phép sửa cấu hình
DROP POLICY IF EXISTS shop_fake_revenue_configs_update_policy ON shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_update_policy 
ON shop_fake_revenue_configs 
FOR UPDATE 
TO authenticated 
USING (
    is_super_admin()
) 
WITH CHECK (
    is_super_admin()
);

-- 6. Chính sách DELETE:
-- - CHỈ Super Admin được phép xóa cấu hình
DROP POLICY IF EXISTS shop_fake_revenue_configs_delete_policy ON shop_fake_revenue_configs;
CREATE POLICY shop_fake_revenue_configs_delete_policy 
ON shop_fake_revenue_configs 
FOR DELETE 
TO authenticated 
USING (
    is_super_admin()
);

-- 7. Trigger tự động cập nhật cột updated_at
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

-- 8. Thông báo PostgREST tải lại schema cache
NOTIFY pgrst, 'reload schema';
