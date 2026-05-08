-- =========================================================================
-- BƯỚC 1: NÂNG CẤP DATABASE CHO TÍNH NĂNG LIVE BED TRACKING
-- =========================================================================

-- 1. Bổ sung các cột theo dõi thời gian và khách hàng vào bảng service_sessions
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS bed_id UUID REFERENCES beds(id) ON DELETE SET NULL;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS is_retail BOOLEAN DEFAULT FALSE;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS retail_customer_name TEXT;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS retail_customer_phone TEXT;

-- Mở rộng độ dài của cột status trong beds nếu cần thiết để hỗ trợ các trạng thái mới (Supabase text thì không bị giới hạn)
-- status của beds hiện tại là: 'available', 'occupied', 'cleaning'
-- status của service_sessions hiện tại là: 'completed', ta sẽ thêm 'in_progress' ở mặt logic Code React.

NOTIFY pgrst, 'reload schema';
