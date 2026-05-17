-- Hàm xóa triệt để tài khoản đăng nhập khỏi hệ thống
-- Giải phóng Email và Username để có thể tạo lại được
CREATE OR REPLACE FUNCTION delete_auth_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Hủy liên kết khóa ngoại ở các bảng lịch sử (để không bị lỗi FK)
  UPDATE public.invoices SET created_by = NULL WHERE created_by = target_user_id;
  
  -- 2. Xóa dữ liệu phân quyền
  DELETE FROM public.user_permissions WHERE user_id = target_user_id;
  
  -- 3. Xóa Profile để giải phóng Username (cho phép tạo lại username này)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- 4. Cuối cùng, xóa tài khoản đăng nhập ở Core Auth của Supabase (giải phóng Email)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
