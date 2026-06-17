const fs = require('fs');
const env = fs.readFileSync('.ENV.Local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data: shops, error: shopsErr } = await supabase.from('spa_shops').select('*');
  console.log('spa_shops:', shops, shopsErr);
}

run();
