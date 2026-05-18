-- Thêm cột status vào bảng commission_logs nếu chưa có
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Thêm cột paid_at để lưu thời gian thanh toán
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Cập nhật lại status schema
-- pending: Đang chờ thanh toán
-- paid: Đã thanh toán
-- cancelled: Bị hủy (do hủy hóa đơn)

-- Trigger để update schema cache
NOTIFY pgrst, 'reload schema';
