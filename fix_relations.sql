-- Chạy script này trong Supabase SQL Editor để sửa lỗi liên kết dữ liệu và làm mới bộ nhớ đệm (schema cache)

-- 1. Đảm bảo cột package_id là khóa ngoại liên kết tới bảng packages
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'customer_packages_package_id_fkey'
    ) THEN
        ALTER TABLE customer_packages 
        ADD CONSTRAINT customer_packages_package_id_fkey 
        FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Đảm bảo cột shop_id là khóa ngoại
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'customer_packages_shop_id_fkey'
    ) THEN
        ALTER TABLE customer_packages 
        ADD CONSTRAINT customer_packages_shop_id_fkey 
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Ép Supabase làm mới lại bộ nhớ đệm (Schema Cache) để nhận diện liên kết
NOTIFY pgrst, 'reload schema';
