-- ==============================================================================
-- SIÊU KIẾN TRÚC DATABASE SaaS SPA/CLINIC (V2 - MASTER)
-- Chuẩn 100% theo 16 nguyên tắc vàng và kiến trúc 4 tầng
-- ==============================================================================

-- Bật các extension cần thiết
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- I & II. SUPER ADMIN & TẦNG SHOP (TENANT)
-- ------------------------------------------------------------------------------
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    max_users INT DEFAULT 1,
    max_branches INT DEFAULT 1,
    price DECIMAL DEFAULT 0
);

CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES plans(id),
    shop_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active', -- active, locked, expired
    expired_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- III & IV. CHI NHÁNH (BRANCHES - NƠI VẬN HÀNH THỰC TẾ)
-- Mọi dữ liệu nghiệp vụ sau này ĐỀU PHẢI map với branch_id
-- ------------------------------------------------------------------------------
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- V. USERS & PHÂN QUYỀN (MULTI-BRANCH HANDLING)
-- ------------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    default_branch_id UUID REFERENCES branches(id), -- Chi nhánh mặc định khi mở app
    username VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('super_admin', 'shop_admin', 'manager', 'staff')),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng trung gian: 1 Nhân viên thuộc 1 chi nhánh, Quản lý thuộc nhiều chi nhánh
CREATE TABLE user_branches (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE user_permissions (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    PRIMARY KEY (user_id, permission)
);

-- ------------------------------------------------------------------------------
-- SETUP: DỊCH VỤ, LIỆU TRÌNH & GIƯỜNG (Có thể theo chi nhánh)
-- ------------------------------------------------------------------------------
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id), -- NULL = Áp dụng toàn hệ thống
    name VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL, -- Dùng cho Realtime Giường
    price DECIMAL NOT NULL,
    commission_rate DECIMAL DEFAULT 0, -- % Hoa hồng cho KTV
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id), 
    name VARCHAR(255) NOT NULL,
    total_sessions INT NOT NULL, -- Số buổi của liệu trình
    price DECIMAL NOT NULL,
    commission_sale_rate DECIMAL DEFAULT 0, -- % Hoa hồng cho người bán (Telesale/Lễ tân)
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE beds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'available', -- available, occupied, maintenance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- VI & IX. BÁN HÀNG & HOÁ ĐƠN (INVOICES)
-- ------------------------------------------------------------------------------
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    subtotal DECIMAL NOT NULL DEFAULT 0,
    discount DECIMAL DEFAULT 0,
    total DECIMAL NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- X. QUẢN LÝ LIỆU TRÌNH (BÁN TRƯỚC - DÙNG DẦN)
-- ------------------------------------------------------------------------------
CREATE TABLE customer_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id), -- Link tới hoá đơn mua
    package_id UUID REFERENCES packages(id) NOT NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    total_sessions INT NOT NULL,
    used_sessions INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- VII, VIII. THỰC HIỆN DỊCH VỤ & REALTIME GIƯỜNG
-- Core Logic: 1 Dịch vụ = 1 Giường = 1 Nhân viên = Realtime Start/End
-- ------------------------------------------------------------------------------
CREATE TABLE service_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    
    -- Nguồn gốc của phiên làm việc này
    invoice_id UUID REFERENCES invoices(id), -- Nếu khách mua lẻ
    customer_package_id UUID REFERENCES customer_packages(id), -- Nếu trừ buổi liệu trình
    
    -- Chi tiết thực hiện
    service_id UUID REFERENCES services(id), -- Dịch vụ đang làm
    bed_id UUID REFERENCES beds(id), -- Giường đang nằm
    staff_id UUID REFERENCES profiles(id), -- KTV đang thực hiện
    
    -- REALTIME TRACKING
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, in_progress, completed, cancelled
    revenue_recorded BOOLEAN DEFAULT FALSE, -- Cờ chốt chặn: Chỉ ghi nhận doanh thu khi hoàn thành
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- XI, XII, XIII. TÀI CHÍNH, HOA HỒNG & BÁO CÁO
-- DOANH THU CHỈ ĐƯỢC GHI KHI HOÀN THÀNH (Dù là lẻ hay liệu trình)
-- ------------------------------------------------------------------------------
CREATE TABLE revenue_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    session_id UUID REFERENCES service_sessions(id), -- Nguồn sinh doanh thu
    amount DECIMAL NOT NULL,
    note TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE commission_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id) NOT NULL,
    session_id UUID REFERENCES service_sessions(id),
    amount DECIMAL NOT NULL,
    type VARCHAR(50), -- service_execution (Làm dịch vụ), package_sale (Bán liệu trình)
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng Nguyên vật liệu (Trừ phí tính lợi nhuận)
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    stock_quantity INT DEFAULT 0,
    cost_per_unit DECIMAL NOT NULL,
    unit VARCHAR(50)
);

CREATE TABLE session_materials (
    session_id UUID REFERENCES service_sessions(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id),
    quantity_used INT NOT NULL,
    total_cost DECIMAL NOT NULL, -- cost_per_unit * quantity
    PRIMARY KEY (session_id, material_id)
);

-- ------------------------------------------------------------------------------
-- XIV. BẢO MẬT & QUYỀN (RLS CHUẨN MỰC THEO SHOP & BRANCH)
-- ------------------------------------------------------------------------------

-- Hàm tiện ích kiểm tra SHOP
CREATE OR REPLACE FUNCTION auth_user_shop_id() RETURNS UUID AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Hàm tiện ích kiểm tra CÁC CHI NHÁNH ĐƯỢC PHÉP
CREATE OR REPLACE FUNCTION auth_user_branch_ids() RETURNS TABLE(branch_id UUID) AS $$
  -- Nếu là shop_admin thì thấy hết, nếu không thì lấy từ user_branches
  SELECT b.id FROM branches b 
  JOIN profiles p ON p.shop_id = b.shop_id AND p.id = auth.uid()
  WHERE p.role = 'shop_admin'
  UNION
  SELECT branch_id FROM user_branches WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- VÍ DỤ RLS BẢNG BEDS (Giường)
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nhân viên chỉ thấy giường trong chi nhánh của mình" ON beds
  FOR SELECT USING (
    shop_id = auth_user_shop_id() 
    AND branch_id IN (SELECT auth_user_branch_ids())
  );

-- Áp dụng tương tự cho tất cả các bảng nghiệp vụ khác...
