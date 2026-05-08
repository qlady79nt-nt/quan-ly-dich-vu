-- =========================================================================
-- BẢN VÁ LỖI CẤU TRÚC: CHUYỂN TƯ DUY DATA SANG LIFECYCLE CHUẨN
-- =========================================================================

-- Việc ép các cột tài chính (revenue_amount, commission_amount) là NOT NULL 
-- là tàn dư của tư duy "Thanh toán ngay lập tức" (Siêu thị).
-- Trong mô hình Live Session, dữ liệu tài chính của cuốc đang chạy (in_progress) 
-- bắt buộc phải là NULL (chưa được chốt), phân biệt rạch ròi với 0đ (miễn phí).

ALTER TABLE service_sessions ALTER COLUMN revenue_amount DROP NOT NULL;
ALTER TABLE service_sessions ALTER COLUMN commission_amount DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
