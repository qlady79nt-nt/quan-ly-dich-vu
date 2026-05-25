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
    const { data: revs, error: rErr } = await supabase
        .from('revenue_logs')
        .select(`
            id,
            service_session_id,
            invoice_id,
            amount
        `)
        .limit(10);
        
    if (rErr) console.error('Error fetching revenue_logs:', rErr);
    else console.log('Real Revenue logs:', JSON.stringify(revs, null, 2));
}

main();
