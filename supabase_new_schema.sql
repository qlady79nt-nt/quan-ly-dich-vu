-- ==========================================
-- KIẾN TRÚC CHUẨN CUỐI CÙNG - HỆ THỐNG QUẢN LÝ SPA SAAS
-- ==========================================

-- 1. RESET DATABASE
DROP TABLE IF EXISTS service_materials CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS commissions CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS shops CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- 2. HỆ THỐNG QUẢN TRỊ (SYSTEM)
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- FREE, PRO_1, PRO_2, PRO_3
    price DECIMAL(12,2) DEFAULT 0,
    max_users INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    shop_code TEXT UNIQUE NOT NULL, -- ABC123
    plan_id UUID REFERENCES plans(id),
    expired_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active', -- active, expired, locked
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    plan_id UUID REFERENCES plans(id),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active'
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Link với auth.users.id
    shop_id UUID REFERENCES shops(id),
    username TEXT NOT NULL, -- lan
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'staff', -- shop_admin, staff
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, username)
);

CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    permission TEXT NOT NULL -- sale.create, report.view...
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. NGHIỆP VỤ SPA (BUSINESS)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(12,2) DEFAULT 0,
    duration_minutes INTEGER DEFAULT 60,
    commission_type TEXT DEFAULT 'percent', -- percent, fixed
    commission_value DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'available', -- available, occupied, cleaning
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id),
    name TEXT NOT NULL,
    total_sessions INTEGER NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    created_by UUID REFERENCES profiles(id),
    total_amount DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    final_amount DECIMAL(12,2) DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'pending', -- pending, paid, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- service, package
    ref_id UUID NOT NULL, -- service_id hoặc package_id
    staff_id UUID REFERENCES profiles(id),
    bed_id UUID REFERENCES beds(id),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'running', -- running, completed
    price DECIMAL(12,2) NOT NULL
);

CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id),
    amount DECIMAL(12,2) NOT NULL,
    type TEXT NOT NULL, -- service_execution, package_sale
    invoice_item_id UUID REFERENCES invoice_items(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cost_price DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_materials (
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (service_id, material_id)
);

-- 4. BẢO MẬT & RLS (ROW LEVEL SECURITY)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Hàm lấy shop_id của user hiện tại
CREATE OR REPLACE FUNCTION auth_user_shop_id() 
RETURNS UUID AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Hàm kiểm tra Super Admin
CREATE OR REPLACE FUNCTION is_super_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Chính sách RLS chuẩn
-- Bảng Shops: 
-- 1. Cho phép tạo mới nếu đã đăng nhập
CREATE POLICY shop_insert_policy ON shops FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- 2. Tách riêng SELECT, UPDATE, DELETE (Postgres không hỗ trợ dấu phẩy trong FOR)
CREATE POLICY shop_select_policy ON shops FOR SELECT USING (id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY shop_update_policy ON shops FOR UPDATE USING (id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY shop_delete_policy ON shops FOR DELETE USING (id = auth_user_shop_id() OR is_super_admin());

-- Các bảng khác dùng FOR ALL
CREATE POLICY profile_isolation ON profiles FOR ALL USING (shop_id = auth_user_shop_id() OR id = auth.uid() OR is_super_admin());
CREATE POLICY data_isolation_services ON services FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_beds ON beds FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_customers ON customers FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_packages ON packages FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_invoices ON invoices FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_commissions ON commissions FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_materials ON materials FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY data_isolation_notifications ON notifications FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
CREATE POLICY user_permissions_isolation ON user_permissions FOR ALL USING (
  user_id = auth.uid() OR 
  is_super_admin() OR 
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'shop_admin' 
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_permissions.user_id 
      AND p.shop_id = auth_user_shop_id()
    )
  )
);

-- 5. DỮ LIỆU MẪU (PLANS)
INSERT INTO plans (name, price, max_users) VALUES 
('FREE', 0, 1),
('PRO_1', 999000, 6),
('PRO_2', 1999000, 10),
('PRO_3', 3999000, 20);