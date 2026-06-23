import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('shops').select('*').ilike('shop_code', 'spa-y9gp68');
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
