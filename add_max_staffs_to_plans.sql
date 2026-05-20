-- MIGRATION: THÊM GIỚI HẠN NHÂN SỰ CHO CÁC GÓI DỊCH VỤ (PLANS)
-- Gói FREE: 3 nhân sự spa, 1 tài khoản đăng nhập
-- Gói PRO 1: 6 nhân sự spa, 3 tài khoản đăng nhập
-- Gói PRO 2: 13 nhân sự spa, 5 tài khoản đăng nhập
-- Gói PRO 3: 25 nhân sự spa, 7 tài khoản đăng nhập

-- 1. Thêm cột max_staffs (số lượng nhân sự tối đa) vào bảng plans nếu chưa có
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_staffs INTEGER DEFAULT 3;

-- 2. Cập nhật giới hạn cho các gói dịch vụ hiện tại (cập nhật cả tên tiếng Anh gốc và tên tiếng Việt mẫu)
-- Cập nhật gói FREE
UPDATE plans 
SET max_users = 1, max_staffs = 3
WHERE name = 'FREE' OR name = 'Gói Dùng Thử (Free)';

-- Cập nhật gói PRO_1
UPDATE plans 
SET max_users = 3, max_staffs = 6
WHERE name = 'PRO_1' OR name = 'Gói Chuyên Nghiệp (Pro)';

-- Cập nhật gói PRO_2
UPDATE plans 
SET max_users = 5, max_staffs = 13
WHERE name = 'PRO_2';

-- Cập nhật gói PRO_3
UPDATE plans 
SET max_users = 7, max_staffs = 25
WHERE name = 'PRO_3' OR name = 'Gói Nâng Cao (Premium)';

-- Tự động thêm mới các gói nếu chưa tồn tại trong Database
INSERT INTO plans (name, price, max_users, max_staffs)
SELECT 'FREE', 0, 1, 3
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'FREE' OR name = 'Gói Dùng Thử (Free)');

INSERT INTO plans (name, price, max_users, max_staffs)
SELECT 'PRO_1', 999000, 3, 6
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'PRO_1' OR name = 'Gói Chuyên Nghiệp (Pro)');

INSERT INTO plans (name, price, max_users, max_staffs)
SELECT 'PRO_2', 1999000, 5, 13
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'PRO_2');

INSERT INTO plans (name, price, max_users, max_staffs)
SELECT 'PRO_3', 3999000, 7, 25
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'PRO_3' OR name = 'Gói Nâng Cao (Premium)');

-- Cập nhật schema cache của PostgREST
NOTIFY pgrst, 'reload schema';
