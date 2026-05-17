-- Hàm xóa triệt để tài khoản đăng nhập khỏi hệ thống
-- Giải phóng Email và Username để có thể tạo lại được
CREATE OR REPLACE FUNCTION delete_auth_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Hủy liên kết khóa ngoại ở các bảng có lưu vết tài khoản thao tác (để không bị lỗi FK)
  -- LƯU Ý: Số liệu tài chính, doanh thu, hoa hồng KHÔNG bị ảnh hưởng vì chúng được liên kết với bảng staffs (Nhân sự), không phải bảng profiles.
  
  -- Hóa đơn (Người tạo & Người hủy)
  UPDATE public.invoices SET created_by = NULL WHERE created_by = target_user_id;
  
  BEGIN
    UPDATE public.invoices SET cancelled_by = NULL WHERE cancelled_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- Liệu trình khách hàng (Người hủy)
  BEGIN
    UPDATE public.customer_packages SET cancelled_by = NULL WHERE cancelled_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- Nhật ký hệ thống (audit_logs)
  BEGIN
    UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN END;
  
  -- 2. Xóa dữ liệu phân quyền
  DELETE FROM public.user_permissions WHERE user_id = target_user_id;
  
  -- 3. Xóa Profile để giải phóng Username (cho phép tạo lại username này)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- 4. Cuối cùng, xóa tài khoản đăng nhập ở Core Auth của Supabase (giải phóng Email)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
