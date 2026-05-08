-- Sửa lại cột start_time để nó tự động lấy giờ máy chủ (Server Time) thay vì do Frontend tự gửi lên
ALTER TABLE service_sessions ALTER COLUMN start_time SET DEFAULT NOW();

NOTIFY pgrst, 'reload schema';
