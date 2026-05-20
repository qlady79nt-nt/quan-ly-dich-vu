-- Hàm cập nhật mật khẩu cho tài khoản đăng nhập
-- Hoạt động dưới quyền SECURITY DEFINER để có quyền chỉnh sửa bảng auth.users
CREATE OR REPLACE FUNCTION update_auth_user_password(target_user_id UUID, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Kiểm tra quyền: Phải là super_admin, hoặc là shop_admin quản lý cùng shop với target_user_id
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (
      role = 'super_admin' OR 
      (role = 'shop_admin' AND shop_id = (SELECT shop_id FROM public.profiles WHERE id = target_user_id))
    )
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền đổi mật khẩu cho tài khoản này.';
  END IF;

  -- Cập nhật mật khẩu được mã hóa trong auth.users
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
END;
$$;
