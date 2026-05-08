-- =========================================================================
-- BẢN VÁ LỖI CẤU TRÚC: PHỤC HỒI NGÀY GIỜ GỐC CHO COMMISSION_LOGS
-- =========================================================================

-- Khi chúng ta thêm cột created_at bằng lệnh DEFAULT NOW(), 
-- Postgres đã tự động gán ngày giờ TẠI THỜI ĐIỂM CHẠY LỆNH (8/5) cho TOÀN BỘ dữ liệu cũ.
-- Điều này khiến tất cả hoa hồng cũ bị dồn hết vào ngày hôm nay.

-- Để khắc phục, chúng ta sẽ copy ngày giờ gốc từ các giao dịch tương ứng đắp qua:

-- 1. Phục hồi ngày giờ cho các cuốc Trừ buổi (service_execution)
UPDATE commission_logs cl
SET created_at = ss.created_at
FROM service_sessions ss
WHERE cl.service_session_id = ss.id;

-- 2. Phục hồi ngày giờ cho các giao dịch Bán gói (package_sale)
UPDATE commission_logs cl
SET created_at = ps.created_at
FROM package_sales ps
WHERE cl.package_sale_id = ps.id;

-- 3. Phục hồi ngày giờ cho các giao dịch Bán lẻ (nếu có lưu bằng reference_id)
UPDATE commission_logs cl
SET created_at = rl.recorded_at
FROM revenue_logs rl
WHERE cl.reference_id = rl.reference_id AND rl.recorded_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
