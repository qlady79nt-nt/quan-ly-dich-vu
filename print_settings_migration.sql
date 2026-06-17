-- Bảng lưu trữ cấu hình in ấn cho từng cửa hàng
CREATE TABLE IF NOT EXISTS shop_print_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL UNIQUE,
    paper_size text DEFAULT '58mm',
    top_offset integer DEFAULT 0,
    left_offset integer DEFAULT 0,
    scale_percent integer DEFAULT 100,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Bật RLS
ALTER TABLE shop_print_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Mọi nhân viên trong shop đều có thể đọc cấu hình in (dùng cho việc in hóa đơn)
CREATE POLICY "Users can view their shop's print settings" 
ON shop_print_settings FOR SELECT 
USING (
  shop_id IN (SELECT shop_id FROM profiles WHERE id = auth.uid())
  OR 
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
);

-- Policy: Chỉ shop_admin và super_admin có thể update/insert
CREATE POLICY "Shop admins and super_admin can modify print settings" 
ON shop_print_settings FOR ALL 
USING (
  (shop_id IN (SELECT shop_id FROM profiles WHERE id = auth.uid() AND role = 'shop_admin'))
  OR 
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
);

-- Hàm trigger để update thời gian (nếu chưa có hàm này trên DB)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_shop_print_settings_updated_at') THEN
        CREATE FUNCTION update_shop_print_settings_updated_at()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END
$$;

DROP TRIGGER IF EXISTS update_shop_print_settings_timestamp ON shop_print_settings;
CREATE TRIGGER update_shop_print_settings_timestamp
BEFORE UPDATE ON shop_print_settings
FOR EACH ROW
EXECUTE FUNCTION update_shop_print_settings_updated_at();
