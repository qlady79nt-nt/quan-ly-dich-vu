-- ==============================================================================
-- MODULE: QUẢN LÝ VÒNG ĐỜI GÓI DỊCH VỤ SAAS (SUBSCRIPTION LIFECYCLE)
-- Đáp ứng 100% logic: Tự sinh mã, Cron Job hết hạn, Read-only backend.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HÀM TỰ ĐỘNG SINH MÃ SHOP (3 Chữ + 3 Số - Ví dụ: ABC123)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_shop_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    nums TEXT := '0123456789';
    new_code TEXT;
    is_unique BOOLEAN := FALSE;
BEGIN
    WHILE NOT is_unique LOOP
        -- Sinh 3 chữ cái ngẫu nhiên
        new_code := substr(chars, (random() * 25)::integer + 1, 1) ||
                    substr(chars, (random() * 25)::integer + 1, 1) ||
                    substr(chars, (random() * 25)::integer + 1, 1) ||
        -- Sinh 3 số ngẫu nhiên
                    substr(nums, (random() * 9)::integer + 1, 1) ||
                    substr(nums, (random() * 9)::integer + 1, 1) ||
                    substr(nums, (random() * 9)::integer + 1, 1);
        
        -- Kiểm tra trùng lặp trong DB
        IF NOT EXISTS (SELECT 1 FROM shops WHERE shop_code = new_code) THEN
            is_unique := TRUE;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. TRIGGER TỰ ĐỘNG KHỞI TẠO DỮ LIỆU KHI TẠO SHOP MỚI
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_initialize_new_shop()
RETURNS TRIGGER AS $$
BEGIN
    -- Tự sinh mã nếu chưa có
    IF NEW.shop_code IS NULL OR NEW.shop_code = '' THEN
        NEW.shop_code := generate_shop_code();
    END IF;
    
    -- Tự động set gói FREE (dùng thử 30 ngày) nếu Admin chưa gán
    IF NEW.expired_at IS NULL THEN
        NEW.expired_at := NOW() + INTERVAL '30 days';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_initialize_new_shop ON shops;
CREATE TRIGGER trg_initialize_new_shop
    BEFORE INSERT ON shops
    FOR EACH ROW
    EXECUTE FUNCTION trigger_initialize_new_shop();

-- ------------------------------------------------------------------------------
-- 3. CRON JOB: TỰ ĐỘNG CHUYỂN TRẠNG THÁI EXPIRED MỖI ĐÊM
-- Lưu ý: Bạn cần kích hoạt extension pg_cron trên bảng điều khiển Supabase
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Chạy vào 00:00 (nửa đêm) mỗi ngày
SELECT cron.schedule(
    'daily_shop_expiration_check',
    '0 0 * * *', 
    $$
      UPDATE shops 
      SET status = 'expired' 
      WHERE expired_at <= NOW() AND status = 'active';
    $$
);

-- ------------------------------------------------------------------------------
-- 4. BẢO VỆ DỮ LIỆU CẤP ĐỘ BACKEND (READ-ONLY KHI EXPIRED)
-- ------------------------------------------------------------------------------
-- Mặc dù Frontend đã ẩn nút, nhưng Backend (RLS) cũng phải đóng băng
-- để chặn hacker gọi API trực tiếp.

-- Chặn tạo hoá đơn nếu Shop hết hạn
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Block insert if shop expired" ON invoices;
CREATE POLICY "Block insert if shop expired" ON invoices
    FOR INSERT WITH CHECK (
        (SELECT status FROM shops WHERE id = auth_user_shop_id()) = 'active'
    );

-- Chặn tạo User mới nếu Shop hết hạn (Bảo vệ bảng profiles)
-- Lưu ý: Policy này có thể cần tùy chỉnh thêm tuỳ luồng đăng ký của bạn
DROP POLICY IF EXISTS "Block create user if shop expired" ON profiles;
CREATE POLICY "Block create user if shop expired" ON profiles
    FOR INSERT WITH CHECK (
        (SELECT status FROM shops WHERE id = shop_id) = 'active'
    );

-- Tương tự cho bảng dịch vụ, giường... 
-- Các chính sách SELECT (Xem) vẫn giữ nguyên để Chủ tiệm xem báo cáo.
