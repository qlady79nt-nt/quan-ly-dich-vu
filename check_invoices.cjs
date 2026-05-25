const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.ENV.Local', 'utf-8');
const envVars = envLocal.split('\n').reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key) acc[key.trim()] = value.join('=').trim().replace(/"/g, '');
    return acc;
}, {});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: sessions, error } = await supabase
        .from('service_sessions')
        .select('id, created_at, status, staff_id')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log('Recent sessions:', sessions);

    const { data: comms } = await supabase
        .from('commission_logs')
        .select('id, created_at, amount, note, service_session_id, staff_id')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log('Recent comms:', comms);
}
main();
