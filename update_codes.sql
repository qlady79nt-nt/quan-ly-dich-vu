-- 1. Thêm cột nếu chưa có
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_code TEXT;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS session_code TEXT;

-- 2. Cập nhật mã hóa đơn cũ (invoices)
-- Bắt đầu bằng HD + 2 số cuối của năm + 4 số ngẫu nhiên
UPDATE invoices 
SET invoice_code = 'HD' || to_char(created_at, 'YY') || lpad(floor(random() * 10000)::text, 4, '0')
WHERE invoice_code IS NULL;

-- Make invoice_code unique (Chạy an toàn)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_invoice_code_key') THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_code_key UNIQUE (invoice_code);
    END IF;
END $$;

-- 3. Cập nhật Mã Phiếu Liệu Trình (customer_packages.card_code)
-- Format: P + 2 số ngẫu nhiên + invoice_code gốc
-- Phải join qua package_sales để lấy invoice_id, rồi lấy invoice_code
UPDATE customer_packages cp
SET card_code = 'P' || lpad(floor(random() * 100)::text, 2, '0') || i.invoice_code
FROM package_sales ps
JOIN invoices i ON i.id = ps.invoice_id
WHERE cp.id = ps.customer_package_id 
AND (cp.card_code IS NULL OR cp.card_code NOT LIKE 'P%');

-- Xử lý các customer_packages cũ không link được với invoices qua package_sales
UPDATE customer_packages 
SET card_code = 'P' || lpad(floor(random() * 100)::text, 2, '0') || 'HD' || to_char(created_at, 'YY') || lpad(floor(random() * 10000)::text, 4, '0')
WHERE card_code IS NULL OR card_code NOT LIKE 'P%';

-- 4. Cập nhật Phiếu trừ buổi (service_sessions.session_code)
-- Format: P + 2 số ngẫu nhiên + invoice_code gốc (của gói liệu trình)
UPDATE service_sessions ss
SET session_code = 'P' || lpad(floor(random() * 100)::text, 2, '0') || substring(cp.card_code from 4)
FROM customer_packages cp
WHERE ss.customer_package_id = cp.id 
AND ss.session_code IS NULL;

-- Cập nhật các phiếu bán lẻ hoặc không có package_id
UPDATE service_sessions 
SET session_code = 'P' || lpad(floor(random() * 100)::text, 2, '0') || 'HD' || to_char(created_at, 'YY') || lpad(floor(random() * 10000)::text, 4, '0')
WHERE session_code IS NULL;
