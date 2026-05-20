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
  console.log("--- 1. Querying plans ---");
  const { data: plans, error: fetchErr } = await supabase.from('plans').select('*');
  console.log("Fetch result:", { plans, fetchErr });

  console.log("\n--- 2. Trying to insert a test plan ---");
  const testPlan = {
    name: 'TEST_PLAN_' + Math.floor(Math.random() * 1000),
    price: 100000,
    max_users: 5
  };
  const { data: insertData, error: insertErr } = await supabase.from('plans').insert([testPlan]).select();
  console.log("Insert result:", { insertData, insertErr });

  console.log("\n--- 3. Let's try inserting with max_branches to see if it fails ---");
  const testPlanWithBranches = {
    name: 'TEST_BRANCH_' + Math.floor(Math.random() * 1000),
    price: 100000,
    max_users: 5,
    max_branches: 2
  };
  const { data: insertData2, error: insertErr2 } = await supabase.from('plans').insert([testPlanWithBranches]).select();
  console.log("Insert with max_branches result:", { insertData2, insertErr2 });
}

run();
