-- =========================================================================
-- BẢN VÁ LỖI CẤU TRÚC: NGĂN CHẶN DOUBLE BOOKING BẰNG UNIQUE INDEX
-- =========================================================================

-- Lỗi Xung Đột Xảy Ra (Race Condition):
-- Nếu 2 Lễ tân cùng ấn "Xếp Giường" vào Giường số 1 ở cùng một phần nghìn giây.
-- React sẽ gửi 2 lệnh INSERT đồng thời, làm sinh ra 2 cuốc dịch vụ in_progress trên cùng 1 giường.

-- GIẢI PHÁP: Sử dụng Partial Unique Index (Chỉ mục duy nhất một phần) của PostgreSQL.
-- Cấu trúc này sẽ tạo ra một Lock cấp độ thấp nhất của DB, quy định: 
-- "Mỗi Giường chỉ được phép có TỐI ĐA 1 phiên làm việc trạng thái 'in_progress'".

-- Bước 1: Xóa index cũ (nếu có) để tránh báo lỗi khi chạy nhiều lần
DROP INDEX IF EXISTS enforce_single_active_session_per_bed;

-- Bước 2: Tạo rào chắn Database (Database Constraint Level)
CREATE UNIQUE INDEX enforce_single_active_session_per_bed 
ON service_sessions(bed_id) 
WHERE status = 'in_progress';

-- Mọi thao tác tranh giành giường thứ 2 sẽ bị Postgres đá văng lập tức với mã lỗi 23505 (Unique Violation).
NOTIFY pgrst, 'reload schema';
