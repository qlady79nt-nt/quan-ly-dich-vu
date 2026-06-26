-- Xóa policy cũ (nếu có) để tránh xung đột
DROP POLICY IF EXISTS "Users can view their shop's print settings" ON shop_print_settings;
DROP POLICY IF EXISTS "Enable read access for users in same shop" ON shop_print_settings;

-- Đảm bảo RLS đã được bật
ALTER TABLE shop_print_settings ENABLE ROW LEVEL SECURITY;

-- Tạo policy cấp quyền SELECT (đọc) cấu hình in
-- Chỉ áp dụng cho user đã đăng nhập (authenticated)
-- User chỉ được đọc cấu hình của shop mà họ thuộc về (dựa vào profiles.shop_id)
-- Super admin được quyền đọc tất cả
CREATE POLICY "Enable read access for users in same shop"
ON shop_print_settings
FOR SELECT
TO authenticated
USING (
    shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid())
    OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);
