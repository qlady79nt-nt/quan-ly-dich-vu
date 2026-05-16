const fs = require('fs');
const env = fs.readFileSync('.ENV.Local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function check() {
  const { data: profs, error } = await supabase.from('profiles').select('id, username, full_name, staff_id');
  console.log('Profiles:', profs);
  const { data: staffs } = await supabase.from('staffs').select('id, full_name');
  console.log('Staffs:', staffs);
}
check();
