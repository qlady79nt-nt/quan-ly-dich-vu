import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrzgpyctnniorxcqjooz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyemdweWN0bm5pb3J4Y3Fqb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjY0MjgsImV4cCI6MjA5MzQ0MjQyOH0.CaAe6jS04xi5mUo2r37_ImI1BDS88sCsjipCftt6Pt0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findPrefix() {
  const prefix = '263049';
  
  const tables = ['invoices', 'package_sessions', 'service_sessions', 'customer_packages', 'package_sales', 'commission_logs'];
  
  for (const table of tables) {
     const { data, error } = await supabase.from(table).select('*').ilike('id', `${prefix}%`);
     if (error) continue;
     
     if (data && data.length > 0) {
       console.log(`\n=== Found in ${table} ===`);
       console.log(JSON.stringify(data, null, 2));
     }
  }
}

findPrefix();
