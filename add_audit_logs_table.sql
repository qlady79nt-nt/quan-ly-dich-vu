-- 1. Tạo bảng Audit Logs (Append-Only)
-- 1. Tạo bảng Audit Logs nếu chưa có
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bổ sung các cột nến bảng đã có từ trước nhưng thiếu
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'UNKNOWN';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'UNKNOWN';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_data JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Cài đặt RLS (Bức tường thép Append-Only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- KHÔNG CÓ POLICY NÀO CHO UPDATE VÀ DELETE! (Append-only)

-- Policy: Cho phép mọi người được ghi log (INSERT)
CREATE POLICY "Allow insert audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);

-- Policy: Super Admin được xem toàn bộ log của hệ thống
CREATE POLICY "Super admin view all logs" ON audit_logs FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

-- Policy: Shop Admin chỉ được xem log của chi nhánh mình
CREATE POLICY "Shop admin view own logs" ON audit_logs FOR SELECT USING (
    shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('shop_admin', 'admin')
);

-- 3. Tạo Index để truy vấn siêu nhanh
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Báo cho Supabase cập nhật schema
NOTIFY pgrst, 'reload schema';
