-- KHỞI TẠO DATABASE CHO HỆ THỐNG QUẢN LÝ DỊCH VỤ (SPA/CLINIC)
-- LOGIC: DOANH THU CHỈ TÍNH KHI LÀM DỊCH VỤ, KHÔNG TÍNH KHI BÁN LIỆU TRÌNH

-- RESET DATABASE (Xoá nếu đã tồn tại để chạy lại sạch)
DROP TABLE IF EXISTS revenue_logs CASCADE;
DROP TABLE IF EXISTS commission_logs CASCADE;
DROP TABLE IF EXISTS package_sales CASCADE;
DROP TABLE IF EXISTS service_sessions CASCADE;
DROP TABLE IF EXISTS customer_packages CASCADE;
DROP TABLE IF EXISTS service_materials CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- 1. DANH MỤC CỬA HÀNG (TENANTS)
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    shop_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active', -- active, locked
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. HỒ SƠ NGƯỜI DÙNG / NHÂN VIÊN
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Cho phép tạo nhân viên "ảo" không cần login, hoặc dùng auth.uid() cho admin
    shop_id UUID REFERENCES shops(id),
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    role TEXT DEFAULT 'staff', -- super_admin, shop_admin, manager, staff
    staff_type TEXT DEFAULT 'both', -- technician, sales, both
    permissions TEXT[] DEFAULT '{}', -- Danh sách quyền chi tiết
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.1 BẢNG HOÁ ĐƠN (INVOICES)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    customer_name TEXT,
    customer_phone TEXT,
    created_by UUID REFERENCES profiles(id),
    total_amount DECIMAL(12,2) DEFAULT 0, -- Trước giảm
    discount_amount DECIMAL(12,2) DEFAULT 0,
    final_amount DECIMAL(12,2) DEFAULT 0, -- Sau giảm
    payment_method TEXT DEFAULT 'cash', -- cash, transfer, card
    status TEXT DEFAULT 'paid', -- paid, void
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 CHI TIẾT HOÁ ĐƠN (INVOICE ITEMS)
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- service, package_sale
    ref_id UUID NOT NULL, -- ID dịch vụ hoặc liệu trình
    staff_id UUID REFERENCES profiles(id), -- Nhân viên được hưởng hoa hồng
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    final_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DỊCH VỤ (SERVICES)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    name TEXT NOT NULL,
    price DECIMAL(12,2) DEFAULT 0,
    duration_minutes INTEGER DEFAULT 60,
    commission_type TEXT DEFAULT 'percent', -- percent, fixed
    commission_value DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LIỆU TRÌNH (PACKAGES)
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    service_id UUID REFERENCES services(id), -- Gắn với 1 dịch vụ cụ thể
    name TEXT NOT NULL,
    total_sessions INTEGER NOT NULL,
    original_price DECIMAL(12,2) NOT NULL,
    discount_type TEXT DEFAULT 'none', -- percent, fixed, none
    discount_value DECIMAL(12,2) DEFAULT 0,
    sale_price DECIMAL(12,2) NOT NULL, -- Giá bán cuối cùng
    commission_sale_type TEXT DEFAULT 'percent', -- HH khi bán gói
    commission_sale_value DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. NGUYÊN VẬT LIỆU (MATERIALS)
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- ml, cái, miếng...
    cost_per_unit DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Định mức NVL cho mỗi dịch vụ
CREATE TABLE service_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL -- Số lượng tiêu hao cho 1 lần làm
);

-- 6. KHÁCH HÀNG SỞ HỮU LIỆU TRÌNH (CUSTOMER PACKAGES)
-- Lưu trữ các gói khách đã mua và số buổi còn lại
CREATE TABLE customer_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    package_id UUID REFERENCES packages(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    total_sessions INTEGER NOT NULL,
    used_sessions INTEGER DEFAULT 0,
    sale_price DECIMAL(12,2) NOT NULL, -- Giá lúc mua
    status TEXT DEFAULT 'active', -- active, completed, expired
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PHIÊN DỊCH VỤ (SERVICE SESSIONS)
-- Ghi nhận mỗi lần làm dịch vụ (Dù là khách lẻ hay trừ buổi liệu trình)
CREATE TABLE service_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    service_id UUID REFERENCES services(id),
    staff_id UUID REFERENCES profiles(id), -- Người thực hiện
    customer_package_id UUID REFERENCES customer_packages(id), -- Nếu là trừ buổi liệu trình
    
    -- Thông tin tài chính tại thời điểm làm
    revenue_amount DECIMAL(12,2) NOT NULL, -- Doanh thu thực ghi nhận
    commission_amount DECIMAL(12,2) DEFAULT 0, -- Hoa hồng nhân viên làm
    material_cost_amount DECIMAL(12,2) DEFAULT 0, -- Chi phí NVL tính tại thời điểm đó
    
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. GIAO DỊCH BÁN GÓI (PACKAGE SALES)
-- Ghi nhận dòng tiền khi bán gói (Không tính vào doanh thu dịch vụ ngay)
CREATE TABLE package_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    customer_package_id UUID REFERENCES customer_packages(id),
    seller_id UUID REFERENCES profiles(id), -- Người bán
    amount_paid DECIMAL(12,2) NOT NULL,
    commission_amount DECIMAL(12,2) DEFAULT 0, -- Hoa hồng người bán gói
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. LOG HOA HỒNG (Dùng để báo cáo tập trung)
CREATE TABLE commission_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    staff_id UUID REFERENCES profiles(id),
    amount DECIMAL(12,2) NOT NULL,
    type TEXT NOT NULL, -- 'service_execution' (làm), 'package_sale' (bán gói)
    reference_id UUID, -- ID của session hoặc package_sale
    note TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. LOG DOANH THU (Dùng để báo cáo nhanh)
CREATE TABLE revenue_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id),
    amount DECIMAL(12,2) NOT NULL,
    cost DECIMAL(12,2) DEFAULT 0, -- Chi phí NVL
    type TEXT NOT NULL, -- 'retail' (khách lẻ), 'package_session' (trừ buổi)
    reference_id UUID,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- PHÂN QUYỀN (RLS) - NÂNG CAO & AN TOÀN
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_logs ENABLE ROW LEVEL SECURITY;

-- 1. Hàm kiểm tra super_admin (Bypass RLS)
CREATE OR REPLACE FUNCTION is_super_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Hàm lấy shop_id của user hiện tại
CREATE OR REPLACE FUNCTION get_user_shop_id() 
RETURNS UUID AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Chính sách cho bảng profiles
CREATE POLICY profile_self_access ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY profile_super_admin_access ON profiles FOR ALL USING (is_super_admin());
CREATE POLICY profile_shop_isolation ON profiles FOR SELECT USING (shop_id = get_user_shop_id());

-- 3. Chính sách cho các bảng dữ liệu theo shop_id
CREATE POLICY shop_isolation_services ON services FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());
CREATE POLICY shop_isolation_packages ON packages FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());
CREATE POLICY shop_isolation_invoices ON invoices FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());
CREATE POLICY shop_isolation_materials ON materials FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());
CREATE POLICY shop_isolation_customer_packages ON customer_packages FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());
CREATE POLICY shop_isolation_service_sessions ON service_sessions FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());
CREATE POLICY shop_isolation_package_sales ON package_sales FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());
CREATE POLICY shop_isolation_commission_logs ON commission_logs FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());
CREATE POLICY shop_isolation_revenue_logs ON revenue_logs FOR ALL USING (is_super_admin() OR shop_id = get_user_shop_id());

-- 4. Chính sách cho các bảng quan hệ phụ thuộc
CREATE POLICY shop_isolation_invoice_items ON invoice_items FOR ALL USING (
    is_super_admin() OR EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_id AND invoices.shop_id = get_user_shop_id())
);
CREATE POLICY shop_isolation_service_materials ON service_materials FOR ALL USING (
    is_super_admin() OR EXISTS (SELECT 1 FROM services WHERE services.id = service_id AND services.shop_id = get_user_shop_id())
);

-- 5. Bảng shops
CREATE POLICY shop_super_admin_access ON shops FOR ALL USING (is_super_admin());
CREATE POLICY shop_self_access ON shops FOR SELECT USING (id = get_user_shop_id());
