-- Thêm các Index để tối ưu tốc độ tra cứu (B-Tree Index) cho hệ thống

-- Index cho service_sessions
CREATE INDEX IF NOT EXISTS idx_service_sessions_customer_package_id
ON service_sessions(customer_package_id);

CREATE INDEX IF NOT EXISTS idx_service_sessions_staff_id
ON service_sessions(staff_id);

CREATE INDEX IF NOT EXISTS idx_service_sessions_shop_id
ON service_sessions(shop_id);

CREATE INDEX IF NOT EXISTS idx_service_sessions_created_at
ON service_sessions(created_at);

-- Index cho customer_packages
CREATE INDEX IF NOT EXISTS idx_customer_packages_package_sale_id
ON customer_packages(package_sale_id);

CREATE INDEX IF NOT EXISTS idx_customer_packages_shop_id
ON customer_packages(shop_id);

-- Index cho package_sales
CREATE INDEX IF NOT EXISTS idx_package_sales_invoice_id
ON package_sales(invoice_id);

CREATE INDEX IF NOT EXISTS idx_package_sales_customer_package_id
ON package_sales(customer_package_id);

-- Index cho commission_logs
CREATE INDEX IF NOT EXISTS idx_commission_logs_service_session_id
ON commission_logs(service_session_id);

CREATE INDEX IF NOT EXISTS idx_commission_logs_staff_id
ON commission_logs(staff_id);

-- Index cho revenue_logs
CREATE INDEX IF NOT EXISTS idx_revenue_logs_service_session_id
ON revenue_logs(service_session_id);

CREATE INDEX IF NOT EXISTS idx_revenue_logs_invoice_id
ON revenue_logs(invoice_id);
