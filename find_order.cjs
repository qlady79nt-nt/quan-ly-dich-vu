const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.ENV.Local' });
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findCode() {
  const code = 'S263049';
  const codeHash = '#S263049';

  console.log('Searching for', code, 'or', codeHash);

  // Check invoices
  const { data: invoices, error: err1 } = await supabase
    .from('invoices')
    .select('*')
    .or(`code.eq.${code},code.eq.${codeHash}`);
  
  if (err1) console.error('invoices error:', err1.message);
  else if (invoices && invoices.length > 0) {
    console.log('Found in invoices:', invoices);
  } else {
    console.log('Not found in invoices');
  }

  // Check commission_logs
  const { data: logs, error: err2 } = await supabase
    .from('commission_logs')
    .select('*')
    .or(`reference_id.eq.${code},reference_id.eq.${codeHash},description.ilike.%${code}%`);

  if (err2) console.error('commission_logs error:', err2.message);
  else if (logs && logs.length > 0) {
    console.log('Found in commission_logs:', logs);
  } else {
    console.log('Not found in commission_logs');
  }

  // Check package_sessions
  const { data: sessions, error: err3 } = await supabase
    .from('package_sessions')
    .select('*')
    .or(`id.eq.${code}`); // Since id is uuid, this will fail if not uuid. Let's just catch it.

  // If there's a code column in package_sessions? let's see.
}

findCode();
