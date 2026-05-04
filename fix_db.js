import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Fix for ES module dirname
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


if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPlans() {
  console.log("Fetching plans...");
  const { data: existingPlans, error: fetchError } = await supabase.from('plans').select('*');
  
  if (fetchError) {
    console.error("Error fetching plans:", fetchError.message);
    return;
  }
  
  console.log(`Found ${existingPlans?.length || 0} plans.`);
  
  if (existingPlans && existingPlans.length > 0) {
    console.log("Deleting old plans...");
    const { error: delError } = await supabase.from('plans').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delError) {
        console.error("Error deleting old plans (Ignore if RLS blocks it):", delError.message);
    }
  }

  console.log("Inserting new plans...");
  const newPlans = [
    { name: 'Gói Dùng Thử (Free)', price: 0, max_users: 1, max_branches: 1 },
    { name: 'Gói Chuyên Nghiệp (Pro)', price: 999000, max_users: 10, max_branches: 2 },
    { name: 'Gói Nâng Cao (Premium)', price: 2500000, max_users: 999, max_branches: 10 }
  ];

  const { data, error: insertError } = await supabase.from('plans').insert(newPlans).select();
  
  if (insertError) {
    console.error("Failed to insert plans:", insertError.message);
  } else {
    console.log("SUCCESSFULLY inserted plans:", data);
  }
}

fixPlans();
