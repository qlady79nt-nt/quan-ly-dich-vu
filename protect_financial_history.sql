-- =========================================================================
-- BẢN VÁ LỖI CẤU TRÚC: BẢO VỆ LỊCH SỬ TÀI CHÍNH (FINANCIAL HISTORY)
-- =========================================================================

-- 1. BẢO VỆ BẢNG COMMISSION_LOGS (Hoa hồng)
-- Gỡ bỏ CASCADE cho nhân viên (staff_id)
ALTER TABLE commission_logs DROP CONSTRAINT IF EXISTS commission_logs_staff_id_fkey;
ALTER TABLE commission_logs ADD CONSTRAINT commission_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staffs(id) ON DELETE SET NULL;

-- Gỡ bỏ CASCADE cho khóa ngoại của cuốc làm dịch vụ
ALTER TABLE commission_logs DROP CONSTRAINT IF EXISTS commission_logs_service_session_id_fkey;
ALTER TABLE commission_logs ADD CONSTRAINT commission_logs_service_session_id_fkey FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE SET NULL;

-- Gỡ bỏ CASCADE cho khóa ngoại của giao dịch bán gói
ALTER TABLE commission_logs DROP CONSTRAINT IF EXISTS commission_logs_package_sale_id_fkey;
ALTER TABLE commission_logs ADD CONSTRAINT commission_logs_package_sale_id_fkey FOREIGN KEY (package_sale_id) REFERENCES package_sales(id) ON DELETE SET NULL;


-- 2. BẢO VỆ BẢNG REVENUE_LOGS (Doanh thu)
-- Tương tự, nếu xóa hóa đơn thì không xóa trắng nhật ký doanh thu mà chỉ set null reference.
ALTER TABLE revenue_logs DROP CONSTRAINT IF EXISTS revenue_logs_invoice_id_fkey;
ALTER TABLE revenue_logs ADD CONSTRAINT revenue_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

ALTER TABLE revenue_logs DROP CONSTRAINT IF EXISTS revenue_logs_package_sale_id_fkey;
ALTER TABLE revenue_logs ADD CONSTRAINT revenue_logs_package_sale_id_fkey FOREIGN KEY (package_sale_id) REFERENCES package_sales(id) ON DELETE SET NULL;

ALTER TABLE revenue_logs DROP CONSTRAINT IF EXISTS revenue_logs_service_session_id_fkey;
ALTER TABLE revenue_logs ADD CONSTRAINT revenue_logs_service_session_id_fkey FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE SET NULL;


-- 3. BẢO VỆ BẢNG PACKAGE_SALES & SERVICE_SESSIONS KHỎI VIỆC XÓA NHÂN VIÊN
ALTER TABLE package_sales DROP CONSTRAINT IF EXISTS package_sales_seller_id_fkey;
ALTER TABLE package_sales ADD CONSTRAINT package_sales_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES staffs(id) ON DELETE SET NULL;

ALTER TABLE service_sessions DROP CONSTRAINT IF EXISTS service_sessions_staff_id_fkey;
ALTER TABLE service_sessions ADD CONSTRAINT service_sessions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staffs(id) ON DELETE SET NULL;

ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_staff_id_fkey;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staffs(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
