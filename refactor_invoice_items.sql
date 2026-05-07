-- =========================================================================
-- BẢN VÁ LỖI CẤU TRÚC: TÁCH REF_ID THÀNH KHÓA NGOẠI CHUẨN
-- =========================================================================

-- 1. Thêm 2 cột khóa ngoại chuẩn vào bảng invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages(id) ON DELETE CASCADE;

-- 2. Chuyển đổi dữ liệu cũ từ ref_id sang 2 cột mới (Migrate data)
UPDATE invoice_items SET service_id = ref_id WHERE type = 'service' AND service_id IS NULL;
UPDATE invoice_items SET package_id = ref_id WHERE (type = 'package' OR type = 'package_sale') AND package_id IS NULL;

-- 3. Xóa cột ref_id cũ (tùy chọn, có thể giữ lại để an toàn, nhưng vì đã sửa app nên có thể xóa)
-- Lưu ý: Chỉ chạy lệnh DROP COLUMN khi chắc chắn web app đã được update (npm run build)
-- Để an toàn, tạm thời em để lệnh này dạng comment. Nếu muốn xóa sạch sẽ, bạn bỏ 2 dấu gạch ngang ở đầu dòng dưới.
-- ALTER TABLE invoice_items DROP COLUMN ref_id;

-- 4. Thêm rule RLS nếu chưa có cho các cột mới (thực ra policy cũ vẫn chạy tốt vì nó check invoice_id)
