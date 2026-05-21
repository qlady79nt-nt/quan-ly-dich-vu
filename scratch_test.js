import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrzgpyctnniorxcqjooz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyemdweWN0bm5pb3J4Y3Fqb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjY0MjgsImV4cCI6MjA5MzQ0MjQyOH0.CaAe6jS04xi5mUo2r37_ImI1BDS88sCsjipCftt6Pt0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: sessions, error } = await supabase
    .from('service_sessions')
    .select('created_at, staff_id, status, revenue_amount')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log("Sessions:", sessions, error);

  const { data: commissions, error: err2 } = await supabase
    .from('commission_logs')
    .select('created_at, staff_id, amount, status')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log("Commissions:", commissions, err2);
}

run();
