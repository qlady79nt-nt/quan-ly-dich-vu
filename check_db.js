import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '.env.local');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1]?.trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1]?.trim();
  });
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking customer_packages...");
  const { data: cp, error: cpErr } = await supabase.from('customer_packages').select('*');
  if (cpErr) console.error("Error fetching customer_packages:", cpErr);
  else console.log("customer_packages rows:", cp.length, cp);

  console.log("Checking package_sales...");
  const { data: ps, error: psErr } = await supabase.from('package_sales').select('*');
  if (psErr) console.error("Error fetching package_sales:", psErr);
  else console.log("package_sales rows:", ps.length, ps);
  
  console.log("Checking invoices...");
  const { data: inv, error: invErr } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(3);
  if (invErr) console.error("Error fetching invoices:", invErr);
  else console.log("Recent invoices:", inv.length, inv);
}

run();
