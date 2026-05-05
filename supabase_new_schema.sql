-- KHỞI TẠO DATABASE CHO HỆ THỐNG QUẢN LÝ DỊCH VỤ (SPA/CLINIC)
-- LOGIC: DOANH THU CHỈ TÍNH KHI LÀM DỊCH VỤ, KHÔNG TÍNH KHI BÁN LIỆU TRÌNH

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
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id),
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    role TEXT DEFAULT 'staff', -- super_admin, shop_admin, manager, staff
    staff_type TEXT DEFAULT 'both', -- technician, sales, both
    status TEXT DEFAULT 'active',
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

-- PHÂN QUYỀN (RLS) - CƠ BẢN
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_logs ENABLE ROW LEVEL SECURITY;

-- Chính sách: Ai thuộc shop nào chỉ thấy dữ liệu shop đó
CREATE POLICY shop_isolation_policy ON profiles FOR ALL USING (shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()));
-- (Và tương tự cho các bảng khác...)
