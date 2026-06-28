const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qrzgpyctnniorxcqjooz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyemdweWN0bm5pb3J4Y3Fqb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjY0MjgsImV4cCI6MjA5MzQ0MjQyOH0.CaAe6jS04xi5mUo2r37_ImI1BDS88sCsjipCftt6Pt0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== 1. service_sessions schema ===");
  const { data: s1, error: e1 } = await supabase.from('service_sessions').select('*').limit(1);
  if (s1 && s1.length > 0) {
    console.log(Object.keys(s1[0]).join("\n"));
  }

  console.log("\n=== 2. services schema ===");
  const { data: s2, error: e2 } = await supabase.from('services').select('*').limit(1);
  if (s2 && s2.length > 0) {
    console.log(Object.keys(s2[0]).join("\n"));
  }

  console.log("\n=== 3 & 4. 5 records of service_sessions ===");
  const { data: s3 } = await supabase.from('service_sessions').select('service_id').limit(5);
  console.log(s3);

  console.log("\n=== 5. 5 records of services ===");
  const { data: s4 } = await supabase.from('services').select('id, name, duration').limit(5);
  console.log(s4);

  console.log("\n=== 6. Verify duration field exists ===");
  if (s2 && s2.length > 0 && 'duration' in s2[0]) {
    console.log("Yes, duration exists in services.");
  } else {
    console.log("No, duration does not exist in services.");
  }

  console.log("\n=== 7. Mapping Example ===");
  if (s4 && s4.length > 0) {
    s4.slice(0, 3).forEach(s => {
      console.log(`${s.name}\nservice_id: ${s.id}\nduration = ${s.duration}\n`);
    });
  }
}

run();
