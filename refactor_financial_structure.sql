-- =========================================================================
-- BƯỚC 1: LÀM SẠCH BẢNG INVOICE_ITEMS (CHỈ GIỮ LẠI DỮ LIỆU TÀI CHÍNH)
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
