-- Chạy script này trong Supabase SQL Editor để thêm trường Mã Thẻ Liệu Trình

ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS card_code TEXT;

-- Cập nhật thêm một chỉ mục (index) để tìm kiếm bằng mã thẻ cho nhanh (tùy chọn)
CREATE INDEX IF NOT EXISTS idx_customer_packages_card_code ON customer_packages(card_code);
