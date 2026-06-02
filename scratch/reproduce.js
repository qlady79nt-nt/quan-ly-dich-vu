import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.ENV.Local', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function reproduce() {
  const shopCode = 'SPA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const username = 'testadmin' + Date.now();
  const fakeEmail = `${username}@${shopCode.toLowerCase()}.spa.local`;
  const password = 'password123';

  console.log('1. Signing up...', fakeEmail);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: fakeEmail,
    password: password,
  });
  if (authErr) return console.error('SignUp Error:', authErr);

  console.log('2. Creating Shop...');
  const { data: plan } = await supabase.from('plans').select('id').eq('name', 'FREE').single();
  const newShopId = crypto.randomUUID();
  const { error: shopErr } = await supabase.from('shops').insert([{
    id: newShopId,
    name: 'Test Shop',
    shop_code: shopCode,
    plan_id: plan?.id || null,
    expired_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  }]);
  if (shopErr) return console.error('Shop Insert Error:', shopErr);

  console.log('3. Creating Profile...');
  const { error: profErr } = await supabase.from('profiles').insert([{
    id: authData.user.id,
    shop_id: newShopId,
    username: username,
    full_name: 'Chủ cửa hàng',
    role: 'shop_admin',
    status: 'active'
  }]);
  if (profErr) return console.error('Profile Insert Error:', profErr);

  console.log('4. Fetching Profile exactly like auth.tsx...');
  const { data: prof, error: fetchErr } = await supabase
    .from('profiles')
    .select('*, shops(name, status, expired_at, shop_code, plans(id, name, max_users, max_staffs))')
    .eq('id', authData.user.id)
    .single();
  
  if (fetchErr) {
    console.error('Fetch Profile Error:', fetchErr);
  } else {
    console.log('Fetched Profile Successfully:', JSON.stringify(prof, null, 2));
  }
}

reproduce();
