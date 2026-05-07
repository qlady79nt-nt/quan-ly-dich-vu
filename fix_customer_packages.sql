-- Chạy script này trong Supabase SQL Editor để cập nhật bảng customer_packages cũ

-- 1. Thêm các cột bị thiếu vào bảng customer_packages
ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS sale_price DECIMAL(12,2) DEFAULT 0;

-- 2. Đảm bảo bảng package_sales tồn tại
CREATE TABLE IF NOT EXISTS package_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_package_id UUID REFERENCES customer_packages(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES profiles(id),
    amount_paid DECIMAL(12,2) NOT NULL,
    commission_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật RLS
ALTER TABLE package_sales ENABLE ROW LEVEL SECURITY;

-- 3. Đảm bảo Policies được cập nhật
DROP POLICY IF EXISTS data_isolation_pkg_sales ON package_sales;
CREATE POLICY data_isolation_pkg_sales ON package_sales FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());

-- Lưu ý: NẾU BẢNG customer_packages ĐÃ TỒN TẠI VÀ CHƯA CÓ RLS
ALTER TABLE customer_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_isolation_cust_pkg ON customer_packages;
CREATE POLICY data_isolation_cust_pkg ON customer_packages FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
