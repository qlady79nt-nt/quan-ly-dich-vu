const fs = require('fs');
const env = fs.readFileSync('.ENV.Local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data: shops, error: shopsErr } = await supabase.from('shops').select('*').in('shop_code', ['SPA-9OIFRM', 'SPA-3XG6Z1']);
  console.log('shops by code:', shops, shopsErr);
  
  if (!shops || shops.length === 0) {
     const { data: shops2, error: shopsErr2 } = await supabase.from('shops').select('*').in('id', ['SPA-9OIFRM', 'SPA-3XG6Z1']);
     console.log('shops by id:', shops2, shopsErr2);
  }
}

run();
