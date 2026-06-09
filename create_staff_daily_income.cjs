const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.ENV.Local');
const envContent = fs.readFileSync(envPath, 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
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
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  console.log('Result:', { data, error });
}
run();
