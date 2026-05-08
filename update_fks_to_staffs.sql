-- BẢN VÁ LỖI KHÓA NGOẠI: CẬP NHẬT REFERENCES TỪ profiles SANG staffs

-- 1. Bảng commission_logs
ALTER TABLE commission_logs DROP CONSTRAINT IF EXISTS commission_logs_staff_id_fkey;
ALTER TABLE commission_logs ADD CONSTRAINT commission_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staffs(id) ON DELETE SET NULL;

-- 2. Bảng package_sales
ALTER TABLE package_sales DROP CONSTRAINT IF EXISTS package_sales_seller_id_fkey;
ALTER TABLE package_sales ADD CONSTRAINT package_sales_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES staffs(id) ON DELETE SET NULL;

-- 3. Bảng service_sessions
ALTER TABLE service_sessions DROP CONSTRAINT IF EXISTS service_sessions_staff_id_fkey;
ALTER TABLE service_sessions ADD CONSTRAINT service_sessions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staffs(id) ON DELETE SET NULL;

-- 4. Bảng invoice_items
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_staff_id_fkey;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staffs(id) ON DELETE SET NULL;

-- 5. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
