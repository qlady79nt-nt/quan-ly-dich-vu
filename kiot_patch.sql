-- Thêm cột kiot_amount vào bảng revenue_reconciliations
ALTER TABLE revenue_reconciliations ADD COLUMN IF NOT EXISTS kiot_amount DECIMAL(12,2) DEFAULT 0;
