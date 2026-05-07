-- Chạy script này trong Supabase SQL Editor để cập nhật lại mã thẻ mới (ngắn gọn hơn: 2 chữ cái + 3 chữ số)

-- 1. Thêm cột card_code vào bảng customer_packages nếu chưa có
ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS card_code TEXT;

-- 2. Thêm chỉ mục (index) để tìm kiếm bằng mã thẻ cho nhanh
CREATE INDEX IF NOT EXISTS idx_customer_packages_card_code ON customer_packages(card_code);

-- 3. Đổi lại toàn bộ mã thẻ cũ thành định dạng mới (2 chữ + 3 số, VD: AB123)
-- Lệnh này sẽ ghi đè các mã thẻ bị dài (bắt đầu bằng PKG-) hoặc bị trống
UPDATE customer_packages
SET card_code = 
    chr(ascii('A') + (random() * 25)::int) || 
    chr(ascii('A') + (random() * 25)::int) || 
    floor(random() * 10)::int || 
    floor(random() * 10)::int || 
    floor(random() * 10)::int
WHERE card_code IS NULL 
   OR trim(card_code) = '' 
   OR length(card_code) > 5
   OR card_code LIKE 'PKG-%';
