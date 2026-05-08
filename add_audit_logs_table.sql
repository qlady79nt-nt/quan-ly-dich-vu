-- 1. Tạo bảng Audit Logs (Append-Only)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Ai là người thực hiện
    action_type TEXT NOT NULL, -- Ví dụ: DELETE_INVOICE, APPLY_DISCOUNT
    entity_type TEXT NOT NULL, -- Ví dụ: INVOICE, STAFF, SERVICE
    entity_id TEXT, -- ID của thực thể bị tác động
    old_data JSONB, -- Dữ liệu trước khi sửa (nếu có)
    new_data JSONB, -- Dữ liệu sau khi sửa (nếu có)
    description TEXT, -- Mô tả dễ hiểu (Ví dụ: "Thu ngân Xóa hóa đơn #123")
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
