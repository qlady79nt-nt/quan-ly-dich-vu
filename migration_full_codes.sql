-- MIGRATION SCRIPT: CHUẨN HÓA TOÀN BỘ MÃ HIỂN THỊ (KHÔNG DÙNG UUID)

-- 1. Xử lý Hóa đơn (Invoices) bị thiếu mã (nếu có)
-- Định dạng: HD + 2 số năm + 4 số ngẫu nhiên
UPDATE invoices 
SET invoice_code = 'HD' || to_char(created_at, 'YY') || lpad(floor(random() * 10000)::text, 4, '0')
WHERE invoice_code IS NULL;

-- 2. Đổi mã Thẻ Liệu Trình (Customer Packages) từ P sang T
UPDATE customer_packages 
SET card_code = 'T' || substring(card_code from 2) 
WHERE card_code LIKE 'P%';

-- 3. Xử lý Thẻ Liệu Trình bị thiếu mã (nếu có)
-- Định dạng: T + 2 số ngẫu nhiên + Mã hóa đơn
UPDATE customer_packages cp
SET card_code = 'T' || lpad(floor(random() * 100)::text, 2, '0') || inv.invoice_code
FROM package_sales ps
JOIN invoices inv ON ps.invoice_id = inv.id
WHERE cp.id = ps.customer_package_id
  AND cp.card_code IS NULL;

-- 4. Cấp mã Phiếu trừ buổi (Package Sessions)
-- Định dạng: P + 2 số ngẫu nhiên + Mã Thẻ
UPDATE service_sessions ss 
SET session_code = 'P' || lpad(floor(random() * 100)::text, 2, '0') || cp.card_code 
FROM customer_packages cp 
WHERE ss.customer_package_id = cp.id 
  AND ss.session_code IS NULL;

-- 5. Cấp mã Phiếu khách lẻ (Retail Sessions)
-- Định dạng: S + 2 số năm + 4 số ngẫu nhiên
UPDATE service_sessions 
SET session_code = 'S' || to_char(created_at, 'YY') || lpad(floor(random() * 10000)::text, 4, '0')
WHERE is_retail = true 
  AND session_code IS NULL;
