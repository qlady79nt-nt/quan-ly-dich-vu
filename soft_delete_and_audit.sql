-- =========================================================================
-- BẢN VÁ BẢO MẬT: SOFT DELETE VÀ AUDIT LOGS (CHỐNG MẤT DỮ LIỆU TÀI CHÍNH)
-- =========================================================================

-- 1. THÊM CỘT SOFT DELETE (XÓA MỀM) VÀO CÁC BẢNG QUAN TRỌNG
-- Giúp ẩn dữ liệu thay vì xóa hẳn, tránh lỗi mất hóa đơn khi xóa khách hàng/dịch vụ
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. ĐỔI RÀNG BUỘC TỪ CASCADE SANG RESTRICT / SET NULL CHO DỮ LIỆU TÀI CHÍNH
-- Chú ý: Việc Drop và Recreate Constraint cần tên chính xác của Constraint hiện tại.
-- Đoạn mã dưới đây là mẫu chuẩn. Trong thực tế Supabase, tên constraint thường là "invoices_customer_id_fkey".
DO $$ 
BEGIN
  -- Hóa đơn không bị xóa khi khách hàng bị xóa
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_customer_id_fkey') THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_customer_id_fkey;
    ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
  END IF;

  -- Hóa đơn không bị xóa khi nhân viên tạo bị xóa
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_created_by_fkey') THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_created_by_fkey;
    ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 3. TẠO BẢNG AUDIT LOGS ĐỂ LƯU VẾT MỌI THAO TÁC NHẠY CẢM
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Ai là người thực hiện
    table_name TEXT NOT NULL, -- Bảng nào bị tác động (invoices, commission, permissions)
    record_id UUID NOT NULL, -- ID của dòng dữ liệu bị tác động
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE, CANCEL
    old_data JSONB, -- Dữ liệu cũ trước khi sửa
    new_data JSONB, -- Dữ liệu mới sau khi sửa
    ip_address TEXT, -- (Tùy chọn) Lưu IP nếu cần
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật RLS cho bảng Audit Logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Nhân viên quản lý / Super Admin mới được xem log của shop mình
DROP POLICY IF EXISTS data_isolation_audit_logs ON audit_logs;
CREATE POLICY data_isolation_audit_logs ON audit_logs 
  FOR SELECT USING (shop_id = auth_user_shop_id() OR is_super_admin());

-- Policy: Mọi người dùng đăng nhập đều có quyền ghi log (thông qua Web App gọi lệnh Insert)
DROP POLICY IF EXISTS insert_audit_logs ON audit_logs;
CREATE POLICY insert_audit_logs ON audit_logs 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =========================================================================
-- Hướng dẫn:
-- Từ nay trên Web App, khi bạn "Xóa" một khách hàng, thay vì gọi lệnh DELETE, 
-- bạn gọi lệnh: UPDATE customers SET deleted_at = NOW() WHERE id = '...'.
-- Khi đó, khách hàng sẽ "biến mất" khỏi danh sách, nhưng các Hóa đơn cũ của khách đó 
-- vẫn được bảo toàn nguyên vẹn trong Báo cáo tài chính!
