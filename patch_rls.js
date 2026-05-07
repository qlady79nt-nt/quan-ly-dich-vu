import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
     DROP POLICY IF EXISTS data_isolation_invoice_items ON invoice_items;
     CREATE POLICY data_isolation_invoice_items ON invoice_items 
     FOR ALL 
     USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.shop_id = auth_user_shop_id()) OR is_super_admin());
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  console.log('Result:', { data, error });
}
run();
