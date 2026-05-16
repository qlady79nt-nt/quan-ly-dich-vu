-- CẬP NHẬT RLS CHO BẢNG user_permissions
-- Cho phép shop_admin được quyền cấp/sửa quyền cho nhân viên trong cùng cửa hàng
DROP POLICY IF EXISTS user_permissions_isolation ON user_permissions;

CREATE POLICY user_permissions_isolation ON user_permissions FOR ALL USING (
  user_id = auth.uid() OR 
  is_super_admin() OR 
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'shop_admin'
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_permissions.user_id 
      AND p.shop_id = auth_user_shop_id()
    )
  )
);
