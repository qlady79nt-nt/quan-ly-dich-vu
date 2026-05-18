-- Cấp quyền bảo vệ dữ liệu bảng staffs cho từng shop (Multi-tenant isolation)
-- ENABLE RLS (Chỉ cần chạy 1 lần, nhưng để đây nếu chưa chạy)
ALTER TABLE staffs ENABLE ROW LEVEL SECURITY;

-- 1. POLICY: SELECT
-- Cho phép đọc staff cùng shop
DROP POLICY IF EXISTS data_isolation_staffs_select ON staffs;
CREATE POLICY data_isolation_staffs_select ON staffs 
FOR SELECT USING (
  shop_id = auth_user_shop_id() 
  OR is_super_admin()
);

-- 2. POLICY: INSERT
-- Cho phép insert vào đúng shop của mình
DROP POLICY IF EXISTS data_isolation_staffs_insert ON staffs;
CREATE POLICY data_isolation_staffs_insert ON staffs 
FOR INSERT WITH CHECK (
  shop_id = auth_user_shop_id() 
  OR is_super_admin()
);

-- 3. POLICY: UPDATE
-- Chỉ sửa dòng của shop mình, và sau khi sửa xong thì shop_id vẫn phải thuộc shop mình
DROP POLICY IF EXISTS data_isolation_staffs_update ON staffs;
CREATE POLICY data_isolation_staffs_update ON staffs 
FOR UPDATE 
USING (
  shop_id = auth_user_shop_id() 
  OR is_super_admin()
)
WITH CHECK (
  shop_id = auth_user_shop_id() 
  OR is_super_admin()
);

-- KHÔNG TẠO DELETE POLICY:
-- Hệ thống sử dụng Soft Delete (UPDATE status = 'inactive' hoặc gán deleted_at = NOW()).
-- Hard delete bị vô hiệu hóa ở tầng Database RLS để bảo vệ lịch sử tài chính và hoạt động.
DROP POLICY IF EXISTS data_isolation_staffs_delete ON staffs;

-- Cập nhật schema cache cho PostgREST
NOTIFY pgrst, 'reload schema';
