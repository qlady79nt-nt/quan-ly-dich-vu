-- =========================================================================
-- BƯỚC 1: TÁCH REF_ID THÀNH KHÓA NGOẠI CHUẨN
-- =========================================================================

-- 1. Thêm 2 cột khóa ngoại chuẩn vào bảng invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages(id) ON DELETE CASCADE;

-- 2. Chuyển đổi dữ liệu cũ từ ref_id sang 2 cột mới (Migrate data)
-- Chỉ chạy nếu cột ref_id vẫn còn tồn tại
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='ref_id') THEN
        EXECUTE 'UPDATE invoice_items SET service_id = ref_id WHERE type = ''service'' AND service_id IS NULL';
        EXECUTE 'UPDATE invoice_items SET package_id = ref_id WHERE (type = ''package'' OR type = ''package_sale'') AND package_id IS NULL';
        
        -- 3. Xóa cột ref_id cũ vì đã chuyển đổi xong
        EXECUTE 'ALTER TABLE invoice_items DROP COLUMN ref_id';
    END IF;
END $$;

-- =========================================================================
-- BƯỚC 2: LÀM SẠCH BẢNG INVOICE_ITEMS (CHỈ GIỮ LẠI DỮ LIỆU TÀI CHÍNH)
-- =========================================================================

-- Xóa các cột liên quan đến hoạt động thực tế (vận hành) khỏi bảng hóa đơn,
-- vì kiến trúc hiện tại đã sử dụng bảng service_sessions (Phiếu thực tế) 
-- và package_sales để theo dõi người bán/người thực hiện/chỗ giường.

ALTER TABLE invoice_items DROP COLUMN IF EXISTS bed_id;
ALTER TABLE invoice_items DROP COLUMN IF EXISTS start_time;
ALTER TABLE invoice_items DROP COLUMN IF EXISTS end_time;
ALTER TABLE invoice_items DROP COLUMN IF EXISTS status;
ALTER TABLE invoice_items DROP COLUMN IF EXISTS staff_id;

-- Sau khi chạy lệnh này, invoice_items sẽ là chuẩn hóa đơn (financial line item):
-- id, invoice_id, type, price, unit_price, final_price, service_id, package_id

NOTIFY pgrst, 'reload schema';
