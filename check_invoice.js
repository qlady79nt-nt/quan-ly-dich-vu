import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrzgpyctnniorxcqjooz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyemdweWN0bm5pb3J4Y3Fqb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjY0MjgsImV4cCI6MjA5MzQ0MjQyOH0.CaAe6jS04xi5mUo2r37_ImI1BDS88sCsjipCftt6Pt0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: inv } = await supabase.from('invoices').select('id, invoice_code').eq('invoice_code', 'HD267802').single();
  if (inv) {
    console.log('Found invoice:', inv.invoice_code, inv.id);
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
    const { data: comms } = await supabase.from('commission_logs').select('*'); // we need to filter by the related ids
    
    console.log('Items:', items.length);
  } else {
    console.log('Invoice HD267802 not found.');
  }
}
run();
