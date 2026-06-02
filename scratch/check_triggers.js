import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.ENV.Local', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    query: "SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_table IN ('users', 'profiles');"
  });
  console.log("Triggers:", data, error);
}

check();
