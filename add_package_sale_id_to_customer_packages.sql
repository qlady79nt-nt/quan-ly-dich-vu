ALTER TABLE customer_packages
ADD COLUMN IF NOT EXISTS package_sale_id UUID
REFERENCES package_sales(id)
ON DELETE SET NULL;

UPDATE customer_packages cp
SET package_sale_id = ps.id
FROM package_sales ps
WHERE ps.customer_package_id = cp.id;
