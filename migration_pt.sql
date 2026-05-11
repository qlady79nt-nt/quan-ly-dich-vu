-- 1. Chuyển đổi mã Thẻ liệu trình (card_code) từ chữ P sang chữ T
UPDATE customer_packages 
SET card_code = 'T' || substring(card_code from 2) 
WHERE card_code LIKE 'P%';

-- 2. Cập nhật lại Mã Phiếu Dùng (session_code) cho các phiếu trừ buổi
-- Định dạng mới: P + 2 số ngẫu nhiên + Mã Thẻ
UPDATE service_sessions ss 
SET session_code = 'P' || lpad(floor(random() * 100)::text, 2, '0') || cp.card_code 
FROM customer_packages cp 
WHERE ss.customer_package_id = cp.id 
  AND ss.customer_package_id IS NOT NULL;
