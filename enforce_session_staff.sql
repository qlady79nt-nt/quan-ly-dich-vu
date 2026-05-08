-- =========================================================================
-- BẢN VÁ LỖI CẤU TRÚC: SIẾT CHẶT BUSINESS RULE CHO SERVICE_SESSIONS
-- =========================================================================

-- Quy tắc nghiệp vụ: 
-- Một phiên dịch vụ (service_session) TRONG THỰC TẾ bắt buộc phải có người làm (KTV).
-- Do đó, staff_id KHÔNG ĐƯỢC PHÉP NULL.

-- 1. Cập nhật các session cũ bị thiếu KTV (gán cho một nhân viên "Hệ thống" hoặc xóa bỏ)
-- Tuy nhiên để an toàn dữ liệu, ta tạm thời không xóa mà chỉ gỡ bỏ cảnh báo lỗi nếu có.
-- Nếu bạn muốn chạy lệnh ALTER TABLE ở dưới thành công, bạn phải đảm bảo không có dòng nào bị NULL.

-- Chạy thử:
-- ALTER TABLE service_sessions ALTER COLUMN staff_id SET NOT NULL;

-- Ghi chú: Nếu báo lỗi "contains null values", bạn phải vào Supabase gán đại 1 nhân viên cho các cuốc bị thiếu trước khi chạy lại lệnh này.

-- Tuy nhiên, nếu dùng Constraint check thì linh hoạt hơn, ta tạo constraint:
ALTER TABLE service_sessions DROP CONSTRAINT IF EXISTS enforce_staff_id_not_null;
ALTER TABLE service_sessions ADD CONSTRAINT enforce_staff_id_not_null CHECK (staff_id IS NOT NULL);

NOTIFY pgrst, 'reload schema';
