import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qrzgpyctnniorxcqjooz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyemdweWN0bm5pb3J4Y3Fqb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjY0MjgsImV4cCI6MjA5MzQ0MjQyOH0.CaAe6jS04xi5mUo2r37_ImI1BDS88sCsjipCftt6Pt0'
);

async function run() {
  console.log('================================================');
  console.log('1. In toàn bộ QUERY đang dùng để lấy dữ liệu tab:');
  console.log(`
supabase.from('service_sessions')
  .select('*, services(name)')
  .eq('shop_id', shopId)
  .gte('created_at', start)
  .lte('created_at', end)
  .eq('status', 'completed');
  `);
  console.log('================================================');
  console.log('2. In ra tên bảng thực tế đang được query:');
  console.log('service_sessions');
  console.log('================================================');

  // Fetch all to analyze
  const { data: allSessions, error } = await supabase.from('service_sessions').select('*, services(name)');
  
  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  const shopId = allSessions[0]?.shop_id;
  const start = '2020-01-01T00:00:00.000Z';
  const end = '2030-12-31T23:59:59.999Z';

  const { data: rawRecords } = await supabase.from('service_sessions')
  .select('*, services(name)')
  .eq('shop_id', shopId)
  .gte('created_at', start)
  .lte('created_at', end)
  .eq('status', 'completed');

  const recordsBeforeFilter = rawRecords || [];

  console.log('3. In ra số lượng record trả về trước khi filter (nhân viên):');
  console.log('recordsBeforeFilter:', recordsBeforeFilter.length);
  console.log('================================================');
  
  console.log('4. In ra 10 record đầu tiên nguyên bản từ database:');
  console.log(JSON.stringify(recordsBeforeFilter.slice(0, 10), null, 2));
  console.log('================================================');

  console.log('5. In ra tất cả field tồn tại trong record đầu tiên:');
  if (recordsBeforeFilter.length > 0) {
    console.log(JSON.stringify(Object.keys(recordsBeforeFilter[0]), null, 2));
  } else {
    console.log('No records found');
  }
  console.log('================================================');

  console.log('6. In ra toàn bộ giá trị status duy nhất:');
  const uniqueStatuses = [...new Set(allSessions.map(r => r.status))];
  console.log(JSON.stringify(uniqueStatuses, null, 2));
  console.log('================================================');

  console.log('7. In ra toàn bộ giá trị staff_id duy nhất.');
  const uniqueStaffIds = [...new Set(allSessions.map(r => r.staff_id))];
  console.log(JSON.stringify(uniqueStaffIds, null, 2));
  console.log('================================================');

  console.log('8. In ra toàn bộ giá trị service_name duy nhất.');
  const uniqueServiceNames = [...new Set(allSessions.map(r => r.services?.name).filter(Boolean))];
  console.log(JSON.stringify(uniqueServiceNames, null, 2));
  console.log('================================================');

  console.log('9. Nếu đang filter theo nhân viên:');
  const selectedStaffId = uniqueStaffIds.find(id => id); // pick first non-null
  console.log('selectedStaffId', selectedStaffId);
  const recordsAfterStaffFilter = recordsBeforeFilter.filter(s => s.staff_id === selectedStaffId);
  console.log('recordsBeforeStaffFilter', recordsBeforeFilter.length);
  console.log('recordsAfterStaffFilter', recordsAfterStaffFilter.length);
  console.log('================================================');

  console.log('10. In ra số lượng record sau từng bước:');
  const afterDateFilter = allSessions.filter(s => s.created_at >= start && s.created_at <= end).length;
  const afterStatusFilter = recordsBeforeFilter.length;
  const afterStaffFilter = recordsAfterStaffFilter.length;
  console.log('afterDateFilter:', afterDateFilter);
  console.log('afterStatusFilter:', afterStatusFilter);
  console.log('afterStaffFilter:', afterStaffFilter);
  
  const countMap = {};
  recordsAfterStaffFilter.forEach(s => {
    const name = s.services?.name || 'Dịch vụ lẻ / Không xác định';
    countMap[name] = (countMap[name] || 0) + 1;
  });
  console.log('afterGroupBy:', Object.keys(countMap).length);
  console.log('================================================');

  console.log('11. In ra object cuối cùng trước khi render bảng:');
  const sortedEntries = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
  const finalObject = sortedEntries.map(([name, count]) => ({ service_name: name, count }));
  console.log(JSON.stringify(finalObject, null, 2));
  console.log('================================================');

  console.log('12. In ra lý do hiển thị dòng: "Không có cuốc dịch vụ nào được thực hiện"');
  console.log('filteredSessions.length === 0');
  console.log('================================================');
}

run();
