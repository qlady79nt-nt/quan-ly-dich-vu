-- =========================================================================
-- BẢN VÁ LỖI CẤU TRÚC: THÊM "SYSTEM ACTOR" CHO CÁC TIẾN TRÌNH TỰ ĐỘNG
-- =========================================================================

-- Thêm cờ nhận diện giao dịch tự động (Hệ thống tạo ra)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS system_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS system_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE package_sales ADD COLUMN IF NOT EXISTS system_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS system_generated BOOLEAN DEFAULT FALSE;

-- Cực kỳ quan trọng cho bảng dòng tiền và hoa hồng (Audit)
ALTER TABLE revenue_logs ADD COLUMN IF NOT EXISTS system_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS system_generated BOOLEAN DEFAULT FALSE;

-- Tạo một View (Tùy chọn) để dễ dàng Audit các hành động của hệ thống
CREATE OR REPLACE VIEW system_audit_logs AS
SELECT 'invoice'::text as type, i.id, i.created_at FROM invoices i WHERE i.system_generated = TRUE
UNION ALL
SELECT 'revenue'::text as type, r.id, r.recorded_at as created_at FROM revenue_logs r WHERE r.system_generated = TRUE
UNION ALL
SELECT 'commission'::text as type, c.id, c.created_at FROM commission_logs c WHERE c.system_generated = TRUE;

NOTIFY pgrst, 'reload schema';
