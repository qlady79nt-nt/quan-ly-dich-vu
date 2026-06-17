const fs = require('fs');
const env = fs.readFileSync('.ENV.Local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data: stores, error: storesErr } = await supabase.from('stores').select('*').in('id', ['SPA-9OIFRM', 'SPA-3XG6Z1']);
  console.log('stores:', stores, storesErr);
  
  const { data: plans, error: plansErr } = await supabase.from('plans').select('*');
  console.log('plans:', plans, plansErr);
  
  const { data: settings, error: settingsErr } = await supabase.from('store_settings').select('*');
  console.log('settings:', settings, settingsErr);
  
  const { data: profiles, error: profsErr } = await supabase.from('profiles').select('*').in('store_id', ['SPA-9OIFRM', 'SPA-3XG6Z1']);
  console.log('profiles:', profiles, profsErr);
}

run();
