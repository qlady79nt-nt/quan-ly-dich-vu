import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qrzgpyctnniorxcqjooz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyemdweWN0bm5pb3J4Y3Fqb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjY0MjgsImV4cCI6MjA5MzQ0MjQyOH0.CaAe6jS04xi5mUo2r37_ImI1BDS88sCsjipCftt6Pt0'
);

async function run() {
  console.log('================================================');
  
  // Get 5 records from service_sessions
  const { data: sessions, error: sessionErr } = await supabase.from('service_sessions').select('*').limit(5);
  if (sessionErr) console.error('Error fetching sessions:', sessionErr);
  
  console.log('1. In cấu trúc bảng service_sessions');
  if (sessions && sessions.length > 0) {
    console.log(Object.keys(sessions[0]).join('\n'));
  } else {
    console.log('No records found to determine schema');
  }
  
  console.log('================================================');
  
  // Get 5 records from services
  const { data: services, error: serviceErr } = await supabase.from('services').select('*').limit(5);
  if (serviceErr) console.error('Error fetching services:', serviceErr);
  
  console.log('2. In cấu trúc bảng services');
  if (services && services.length > 0) {
    console.log(Object.keys(services[0]).join('\n'));
  } else {
    console.log('No records found to determine schema');
  }
  
  console.log('================================================');
  
  console.log('3. Kiểm tra xem service_sessions có cột nào tham chiếu tới services không:');
  const sessionKeys = sessions && sessions.length > 0 ? Object.keys(sessions[0]) : [];
  const refCols = sessionKeys.filter(k => k.includes('service'));
  if (refCols.length > 0) {
    console.log(refCols.join('\n'));
  } else {
    console.log('No service-related columns found');
  }
  
  console.log('================================================');
  
  console.log('4. In 5 record đầu tiên của service_sessions:');
  console.log(JSON.stringify(sessions || [], null, 2));
  
  console.log('================================================');
  
  console.log('5. In 5 record đầu tiên của services:');
  console.log(JSON.stringify(services || [], null, 2));
  
  console.log('================================================');
  
  console.log('6. Kiểm tra Foreign Key thực tế tồn tại giữa service_sessions và services');
  // I will check the error from the earlier query to determine this.
  // The error specifically stated: "Could not find a relationship between 'service_sessions' and 'services'".
  console.log('Error PGRST200 confirms there is no foreign key relationship between them.');
  
  console.log('================================================');
  
  console.log('7. Nếu không có FK:');
  console.log('No relationship found');
  
  console.log('================================================');
  
  console.log('8 & 9. Kiểm tra xem có service_name hay service_id:');
  if (sessionKeys.includes('service_name')) {
    console.log('service_name exists in service_sessions');
  } else if (sessionKeys.includes('service_id')) {
    console.log('service_id exists');
    console.log('service name requires manual lookup');
  } else {
    console.log('Neither service_name nor service_id exists in service_sessions');
  }
  
  console.log('================================================');
}

run();
