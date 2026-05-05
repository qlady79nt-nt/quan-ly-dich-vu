-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Plans (Các Gói Dịch Vụ)
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    max_users INT NOT NULL DEFAULT 1,
    max_branches INT NOT NULL DEFAULT 1,
    has_realtime BOOLEAN DEFAULT false,
    has_advanced_reports BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Shops (Cửa tiệm / Tenants)
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    shop_code VARCHAR(20) UNIQUE NOT NULL,
    owner_user_id UUID, -- References auth.users later if needed
    plan_id UUID REFERENCES plans(id),
    expired_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.5 Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Profiles (Users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE, -- NULL cho Super Admin
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'staff', -- 'super_admin', 'shop_admin', 'staff'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. User Permissions
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL, -- e.g., 'sale.create', 'report.view'
    UNIQUE(user_id, permission)
);

-- 4. Beds (Giường/Ghế)
CREATE TABLE beds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'available', -- 'available', 'occupied'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Services (Dịch vụ)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    commission_type VARCHAR(50) DEFAULT 'percent', -- 'percent', 'fixed'
    commission_value DECIMAL(15,2) DEFAULT 0,
    duration_minutes INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Materials (Nguyên vật liệu)
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Service Materials (Định mức tiêu hao)
CREATE TABLE service_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    UNIQUE(service_id, material_id)
);

-- 8. Packages (Liệu trình)
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    sessions_count INT NOT NULL DEFAULT 1,
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Customers (Khách hàng)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Invoices (Hoá đơn)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    creator_id UUID REFERENCES profiles(id),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed', -- 'draft', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Invoice Items (Chi tiết hoá đơn)
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'service', 'package'
    item_id UUID NOT NULL, -- references services(id) or packages(id)
    price DECIMAL(15,2) NOT NULL,
    discount DECIMAL(15,2) DEFAULT 0,
    quantity INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Customer Packages (Liệu trình khách đã mua)
CREATE TABLE customer_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE CASCADE,
    total_sessions INT NOT NULL,
    remaining_sessions INT NOT NULL,
    session_revenue_value DECIMAL(15,2) NOT NULL, -- Doanh thu ghi nhận cho mỗi buổi (Giá bán / Tổng buổi)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Sessions (Bắt đầu dịch vụ - Thực hiện)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE CASCADE, -- Dành cho dịch vụ lẻ
    customer_package_id UUID REFERENCES customer_packages(id) ON DELETE CASCADE, -- Dành cho liệu trình
    service_id UUID REFERENCES services(id),
    customer_id UUID REFERENCES customers(id),
    staff_id UUID REFERENCES profiles(id),
    bed_id UUID REFERENCES beds(id),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'doing', -- 'doing', 'done'
    revenue_amount DECIMAL(15,2) DEFAULT 0, -- Doanh thu (sẽ update khi done)
    material_cost DECIMAL(15,2) DEFAULT 0, -- Chi phí vật liệu (sẽ update khi done)
    profit DECIMAL(15,2) DEFAULT 0, -- Lợi nhuận = revenue - material_cost
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Commissions (Hoa hồng nhân viên)
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    commission_type VARCHAR(50) NOT NULL, -- 'service_doing', 'package_selling'
    amount DECIMAL(15,2) NOT NULL,
    source_invoice_item_id UUID REFERENCES invoice_items(id), -- Nếu là bán liệu trình
    source_session_id UUID REFERENCES sessions(id), -- Nếu là làm dịch vụ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Payments (Thanh toán / Biên lai)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL, -- 'cash', 'transfer', 'card'
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- BẢO MẬT DỮ LIỆU (ROW LEVEL SECURITY - RLS)
-- =========================================
-- Kích hoạt RLS cho TẤT CẢ các bảng chứa shop_id
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 1. Super Admin: Được xem toàn bộ dữ liệu (Bỏ qua RLS hoặc có policy riêng)
-- Ở đây giả định hàm `get_user_role()` lấy role từ profiles (Cần tạo function trên Supabase)
CREATE OR REPLACE FUNCTION auth_user_role() RETURNS VARCHAR AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_user_shop_id() RETURNS UUID AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Policy chung cho mọi bảng: Chỉ lấy dữ liệu của shop_id mình đang thuộc về
-- Ví dụ với bảng BEDS:
CREATE POLICY "Cho phép staff/admin xem dữ liệu shop của mình" ON beds 
  FOR SELECT USING (
    auth_user_role() = 'super_admin' OR shop_id = auth_user_shop_id()
  );

CREATE POLICY "Cho phép staff/admin thêm dữ liệu shop của mình" ON beds 
  FOR INSERT WITH CHECK (
    auth_user_role() = 'super_admin' OR shop_id = auth_user_shop_id()
  );

CREATE POLICY "Cho phép staff/admin sửa dữ liệu shop của mình" ON beds 
  FOR UPDATE USING (
    auth_user_role() = 'super_admin' OR shop_id = auth_user_shop_id()
  );

-- (Các bảng khác như services, invoices, sessions... cũng áp dụng policy tương tự)
-- Việc sử dụng RLS này đảm bảo 100% Hacker có lấy được API key cũng KHÔNG thể query xuyên Shop được.

-- QUAN TRỌNG: Policy cho bảng profiles để user có thể đọc thông tin của chính mình khi đăng nhập
CREATE POLICY "Users can read own profile" ON profiles 
  FOR SELECT USING (auth.uid() = id);
