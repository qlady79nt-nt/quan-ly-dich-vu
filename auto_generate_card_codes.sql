-- Chạy script này trong Supabase SQL Editor để tự động sinh mã thẻ cho các khách hàng cũ chưa có mã thẻ

-- Cập nhật mã thẻ tự động (VD: PKG-A1B2C3) cho các dòng bị trống mã thẻ
UPDATE customer_packages
SET card_code = 'PKG-' || upper(substr(md5(random()::text), 1, 6))
WHERE card_code IS NULL OR trim(card_code) = '';
