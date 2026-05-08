-- Thêm các cột phục vụ việc Hủy (Cancellation)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Thêm cột status cho revenue_logs và commission_logs để loại trừ khỏi báo cáo
ALTER TABLE revenue_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

NOTIFY pgrst, 'reload schema';
