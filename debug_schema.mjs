import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qrzgpyctnniorxcqjooz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyemdweWN0bm5pb3J4Y3Fqb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjY0MjgsImV4cCI6MjA5MzQ0MjQyOH0.CaAe6jS04xi5mUo2r37_ImI1BDS88sCsjipCftt6Pt0'
);

async function run() {
  const { data, error } = await supabase.from('service_sessions').select('*').limit(1);
  console.log(JSON.stringify(data, null, 2));
}
run();
