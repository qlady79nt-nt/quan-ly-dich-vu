-- =========================================================================
-- BẢN VÁ LỖI TOÀN VẸN DỮ LIỆU (DATA INTEGRITY PATCH) - QUAN TRỌNG
-- =========================================================================

-- 1. Vá lỗi thiếu cột ở bảng "Gói Khách Hàng" (customer_packages)
-- Gây lỗi mất hóa đơn khi bấm thanh toán "Bán gói" vì thiếu chỗ lưu mã thẻ
ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS card_code TEXT;

-- 2. Vá lỗi thiếu cột ở bảng "Bán Gói" (package_sales)
-- Gây đứt gãy liên kết giữa Doanh Thu và Hóa Đơn gốc
ALTER TABLE package_sales ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;

-- 3. Đảm bảo toàn vẹn khóa ngoại (Foreign Keys) cho RLS trên bảng invoice_items
-- Nếu chưa có chính sách này, nhân viên sẽ không xem được dịch vụ trong hóa đơn
DROP POLICY IF EXISTS data_isolation_invoice_items ON invoice_items;
CREATE POLICY data_isolation_invoice_items ON invoice_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND (invoices.shop_id = auth_user_shop_id() OR is_super_admin())
  )
);

-- 4. Đảm bảo toàn vẹn dữ liệu bảng invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- 5. Bật RLS cho các bảng báo cáo nếu bị tắt nhầm
ALTER TABLE customer_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_logs ENABLE ROW LEVEL SECURITY;

-- Tạo lại các Policy cách ly dữ liệu shop (đảm bảo không bị thất thoát dữ liệu giữa các cửa hàng)
DROP POLICY IF EXISTS data_isolation_cust_pkg ON customer_packages;
CREATE POLICY data_isolation_cust_pkg ON customer_packages FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS data_isolation_pkg_sales ON package_sales;
CREATE POLICY data_isolation_pkg_sales ON package_sales FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS data_isolation_svc_sess ON service_sessions;
CREATE POLICY data_isolation_svc_sess ON service_sessions FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS data_isolation_rev_logs ON revenue_logs;
CREATE POLICY data_isolation_rev_logs ON revenue_logs FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS data_isolation_comm_logs ON commission_logs;
CREATE POLICY data_isolation_comm_logs ON commission_logs FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
