import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('c:/A/QuanLyDichVu/.env.local', 'utf8');
let supabaseUrl = '', supabaseKey = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: invs } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(10);
  console.log('Recent invoices:');
  invs.forEach(i => console.log(i.invoice_code, i.created_at, i.status));
}
run();
