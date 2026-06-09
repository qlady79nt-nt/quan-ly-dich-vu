CREATE TABLE IF NOT EXISTS staff_daily_income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    staff_name TEXT NOT NULL,
    tip_amount NUMERIC DEFAULT 0,
    tour_amount NUMERIC DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    meal_amount NUMERIC DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staff_daily_income ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_isolation_staff_daily_income ON staff_daily_income;
CREATE POLICY data_isolation_staff_daily_income ON staff_daily_income 
FOR ALL USING (shop_id = auth_user_shop_id() OR is_super_admin());
