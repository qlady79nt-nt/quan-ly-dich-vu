const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.ENV.Local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: invs, error: invErr } = await supabase.from('invoices').select('*').ilike('invoice_code', '%HD264404%');
  console.log('Invoices:', invs);

  if (invs && invs.length > 0) {
    const { data: ps } = await supabase.from('package_sales').select('*').eq('invoice_id', invs[0].id);
    console.log('Package Sales:', ps);

    if (ps && ps.length > 0) {
      const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', ps[0].customer_package_id);
      console.log('Customer Packages:', cp);
      
      const { data: ss } = await supabase.from('service_sessions').select('*').eq('customer_package_id', ps[0].customer_package_id);
      console.log('Service Sessions:', ss);
    }
  }
}
check();
