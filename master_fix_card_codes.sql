-- Chạy script này trong Supabase SQL Editor để giải quyết toàn bộ cấu trúc và dữ liệu của Mã Thẻ Liệu Trình

-- 1. Thêm cột card_code vào bảng customer_packages nếu chưa có
ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS card_code TEXT;

-- 2. Thêm chỉ mục (index) để tìm kiếm bằng mã thẻ cho nhanh
CREATE INDEX IF NOT EXISTS idx_customer_packages_card_code ON customer_packages(card_code);

-- 3. Cập nhật mã thẻ tự động (VD: PKG-A1B2C3) cho các dòng bị trống mã thẻ hiện tại
UPDATE customer_packages
SET card_code = 'PKG-' || upper(substr(md5(random()::text), 1, 6))
WHERE card_code IS NULL OR trim(card_code) = '';
