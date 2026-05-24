const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.ENV.Local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');
let url = '';
let key = '';
for (let line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function run() {
  const { data: staffs } = await supabase.from('staffs').select('id, full_name, shop_id');
  console.log('All staffs:', staffs);
  
  if (!staffs || staffs.length === 0) return;
  
  const staffId = staffs[0].id;
  
  const { data: sessions } = await supabase
    .from('service_sessions')
    .select('id, staff_id, status, created_at, revenue_amount')
    .eq('staff_id', staffId);
    
  console.log(`Sessions for ${staffs[0].full_name}:`, sessions.length);
  if (sessions.length > 0) {
     console.log(sessions.slice(0, 3));
  }
}

run();
