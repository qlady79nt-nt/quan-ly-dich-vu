-- Xóa bảng cũ (nếu có bị lỗi schema trước đó) để tạo lại cho sạch
DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, 
    action_type TEXT DEFAULT 'UNKNOWN', 
    entity_type TEXT DEFAULT 'UNKNOWN', 
    entity_id TEXT, 
    old_data JSONB, 
    new_data JSONB, 
    description TEXT, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cài đặt RLS (Bức tường thép Append-Only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tạm thời mở RLS toàn tập để đảm bảo KHÔNG BỊ LỖI QUYỀN
-- (Lát nữa hệ thống ổn định ta sẽ khóa lại)
CREATE POLICY "Allow ALL" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 3. Tạo Index để truy vấn siêu nhanh
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

NOTIFY pgrst, 'reload schema';
