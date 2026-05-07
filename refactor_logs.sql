-- =========================================================================
-- BẢN VÁ LỖI CẤU TRÚC: TÁCH REFERENCE_ID TRONG BẢNG LOGS
-- =========================================================================

-- A. BẢNG REVENUE_LOGS (Nhật ký Doanh Thu)
-- 1. Thêm các cột khóa ngoại chuẩn
ALTER TABLE revenue_logs ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE revenue_logs ADD COLUMN IF NOT EXISTS package_sale_id UUID REFERENCES package_sales(id) ON DELETE CASCADE;
ALTER TABLE revenue_logs ADD COLUMN IF NOT EXISTS service_session_id UUID REFERENCES service_sessions(id) ON DELETE CASCADE;

-- 2. Migrate dữ liệu cũ từ reference_id
UPDATE revenue_logs SET invoice_id = reference_id WHERE type = 'retail' AND invoice_id IS NULL;
UPDATE revenue_logs SET package_sale_id = reference_id WHERE type = 'package_sale' AND package_sale_id IS NULL;
UPDATE revenue_logs SET service_session_id = reference_id WHERE type = 'package_session' AND service_session_id IS NULL;

-- 3. (Tùy chọn) Xóa cột cũ để CSDL sạch sẽ hoàn toàn
-- ALTER TABLE revenue_logs DROP COLUMN reference_id;

-- =========================================================================

-- B. BẢNG COMMISSION_LOGS (Nhật ký Hoa Hồng)
-- 1. Thêm các cột khóa ngoại chuẩn
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS service_session_id UUID REFERENCES service_sessions(id) ON DELETE CASCADE;
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS package_sale_id UUID REFERENCES package_sales(id) ON DELETE CASCADE;

-- 2. Migrate dữ liệu cũ từ reference_id
UPDATE commission_logs SET service_session_id = reference_id WHERE type = 'service_execution' AND service_session_id IS NULL;
UPDATE commission_logs SET package_sale_id = reference_id WHERE type = 'package_sale' AND package_sale_id IS NULL;

-- 3. (Tùy chọn) Xóa cột cũ để CSDL sạch sẽ hoàn toàn
-- ALTER TABLE commission_logs DROP COLUMN reference_id;

