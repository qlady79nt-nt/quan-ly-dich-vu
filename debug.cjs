const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Querying service_sessions...');
  const { data, error } = await supabase
    .from('service_sessions')
    .select('id, created_at, status, revenue_amount, is_retail, customer_package_id, services(name, price)')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
