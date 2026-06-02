const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .ENV.Local
const env = fs.readFileSync('.ENV.Local', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('Checking Shop SPA-3XG6Z1...');
  const { data: shops, error: err1 } = await supabase
    .from('shops')
    .select('*')
    .eq('shop_code', 'SPA-3XG6Z1');
  
  if (err1) console.error('Error fetching shop:', err1);
  console.log('Shops:', shops);

  if (shops && shops.length > 0) {
    const shopId = shops[0].id;
    const { data: profiles, error: err2 } = await supabase
      .from('profiles')
      .select('*')
      .eq('shop_id', shopId);
    
    if (err2) console.error('Error fetching profiles:', err2);
    console.log('Profiles for this shop:', profiles);
  } else {
    console.log('Shop not found, checking all profiles for a related code...');
    const { data: profiles, error: err3 } = await supabase
      .from('profiles')
      .select('*')
      .limit(5)
      .order('created_at', { ascending: false });
    console.log('Recent profiles:', profiles);
  }
}

checkData();
