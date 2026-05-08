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
  console.log("Checking commission_logs...");
  const { data: cl, error: clErr } = await supabase.from('commission_logs').select('*').limit(3);
  if (clErr) console.error("Error fetching commission_logs:", clErr.message);
  else console.log("commission_logs rows:", cl.length, cl);

  console.log("Checking commissions...");
  const { data: c, error: cErr } = await supabase.from('commissions').select('*').limit(3);
  if (cErr) console.error("Error fetching commissions:", cErr.message);
  else console.log("commissions rows:", c.length, c);

  console.log("Checking staffs...");
  const { data: s, error: sErr } = await supabase.from('staffs').select('*').limit(3);
  if (sErr) console.error("Error fetching staffs:", sErr.message);
  else console.log("staffs rows:", s.length, s);
}

run();
