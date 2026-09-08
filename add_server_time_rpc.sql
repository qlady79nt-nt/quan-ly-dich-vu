-- ====================================================================
-- Migration: add_server_time_rpc.sql
-- Mục đích: Cung cấp nguồn thời gian chuẩn Supabase Cloud Server cho POSA
-- Timezone chuẩn: Asia/Ho_Chi_Minh (UTC+7)
-- An toàn: Hàm STABLE chỉ đọc now(), tuyệt đối không đụng chạm bảng nghiệp vụ
-- Quyền hạn: CHỈ GRANT cho authenticated, KHÔNG grant anon
-- ====================================================================

CREATE OR REPLACE FUNCTION public.sp_get_server_time()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'server_time_utc', now(),
    'server_date_vn', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
    'server_time_vn', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    'timezone', 'Asia/Ho_Chi_Minh'
  );
$$;

-- Thu hồi quyền từ public/anon và CHỈ cấp quyền cho authenticated
REVOKE EXECUTE ON FUNCTION public.sp_get_server_time() FROM public;
REVOKE EXECUTE ON FUNCTION public.sp_get_server_time() FROM anon;
GRANT EXECUTE ON FUNCTION public.sp_get_server_time() TO authenticated;
