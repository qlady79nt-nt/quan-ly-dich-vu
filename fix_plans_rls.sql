-- CẬP NHẬT CHÍNH SÁCH BẢO MẬT (RLS) CHO BẢNG PLANS (GÓI DỊCH VỤ)
-- Nguyên nhân: Bảng plans được bật RLS trên Supabase nhưng chưa cấu hình các chính sách (policies), 
-- dẫn tới client (dùng anon key) không thể đọc danh sách gói và trả về kết quả rỗng ([])

-- 1. Bật tính năng Row Level Security (RLS) cho bảng plans (nếu chưa bật)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- 2. Cho phép TẤT CẢ mọi người (kể cả khách chưa đăng nhập / anonymous) có thể xem (SELECT) danh sách gói dịch vụ
-- Lý do: Đăng ký tài khoản (Register) và cấu hình shop cần phải xem gói dịch vụ khi chưa đăng nhập hoặc đăng nhập với các role khác nhau
DROP POLICY IF EXISTS plans_select_policy ON plans;
CREATE POLICY plans_select_policy ON plans 
FOR SELECT USING (true);

-- 3. Chỉ cho phép Super Admin được Thêm mới (INSERT) gói dịch vụ
DROP POLICY IF EXISTS plans_insert_policy ON plans;
CREATE POLICY plans_insert_policy ON plans 
FOR INSERT WITH CHECK (is_super_admin());

-- 4. Chỉ cho phép Super Admin được Cập nhật (UPDATE) gói dịch vụ
DROP POLICY IF EXISTS plans_update_policy ON plans;
CREATE POLICY plans_update_policy ON plans 
FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());

-- 5. Chỉ cho phép Super Admin được Xóa (DELETE) gói dịch vụ
DROP POLICY IF EXISTS plans_delete_policy ON plans;
CREATE POLICY plans_delete_policy ON plans 
FOR DELETE USING (is_super_admin());

-- Cập nhật schema cache của PostgREST
NOTIFY pgrst, 'reload schema';
