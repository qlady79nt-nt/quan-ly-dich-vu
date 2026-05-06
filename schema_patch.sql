-- Thêm các cột còn thiếu vào bảng services
ALTER TABLE services ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Thêm các cột còn thiếu vào bảng packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS original_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'none';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) DEFAULT 0;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS sale_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS commission_sale_type TEXT DEFAULT 'percent';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS commission_sale_value DECIMAL(12,2) DEFAULT 0;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Thêm các cột còn thiếu vào bảng invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Thêm các cột còn thiếu vào bảng invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS final_price DECIMAL(12,2) DEFAULT 0;

-- ==========================================
-- TẠO CÁC BẢNG LOGIC MỚI CHO POS VÀ BÁO CÁO (NẾU CHƯA CÓ)
-- ==========================================

CREATE TABLE IF NOT EXISTS customer_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_phone TEXT NOT NULL,
    total_sessions INTEGER NOT NULL,
    used_sessions INTEGER DEFAULT 0,
    sale_price DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS package_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_package_id UUID REFERENCES customer_packages(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES profiles(id),
    amount_paid DECIMAL(12,2) NOT NULL,
    commission_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id),
    customer_package_id UUID REFERENCES customer_packages(id),
    revenue_amount DECIMAL(12,2) DEFAULT 0,
    commission_amount DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    type TEXT NOT NULL, -- retail, package_session
    reference_id UUID,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commission_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id),
    amount DECIMAL(12,2) NOT NULL,
    type TEXT NOT NULL, -- service_execution, package_sale
    reference_id UUID,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- BẬT RLS (ROW LEVEL SECURITY) CHO CÁC BẢNG MỚI
-- ==========================================
ALTER TABLE customer_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_logs ENABLE ROW LEVEL SECURITY;

-- Tạo Policy Cách ly dữ liệu
CREATE POLICY data_isolation_cust_pkg ON customer_packages FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_pkg_sales ON package_sales FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_svc_sess ON service_sessions FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_rev_logs ON revenue_logs FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_comm_logs ON commission_logs FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
