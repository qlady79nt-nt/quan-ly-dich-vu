-- =========================================================================
-- TỔNG HỢP TOÀN BỘ CÁC LỆNH UPDATE DATABASE CHO TÍNH NĂNG MỚI
-- (Hãy Copy toàn bộ file này và dán vào Supabase SQL Editor rồi bấm RUN)
-- =========================================================================

-- 1. Sửa lỗi "Ngáo" Ngày giờ: Phục hồi lại ngày giờ gốc cho các khoản hoa hồng cũ
UPDATE commission_logs cl SET created_at = ss.created_at FROM service_sessions ss WHERE cl.service_session_id = ss.id;
UPDATE commission_logs cl SET created_at = ps.created_at FROM package_sales ps WHERE cl.package_sale_id = ps.id;

-- 2. Thêm các cột theo dõi "Thời gian thực" vào bảng service_sessions
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS bed_id UUID REFERENCES beds(id) ON DELETE SET NULL;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS is_retail BOOLEAN DEFAULT FALSE;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS retail_customer_name TEXT;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS retail_customer_phone TEXT;

-- 3. Tạo "Lá chắn thép" chống Double-Booking Giường (Lễ tân bấm trùng giường)
DROP INDEX IF EXISTS enforce_single_active_session_per_bed;
CREATE UNIQUE INDEX enforce_single_active_session_per_bed ON service_sessions(bed_id) WHERE status = 'in_progress';

-- 4. Báo cho Supabase cập nhật lại cấu trúc
NOTIFY pgrst, 'reload schema';