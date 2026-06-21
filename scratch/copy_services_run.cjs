const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.ENV.Local', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sourceCode = 'SPA-9OIFRM';
  const targetCode = 'SPA-Y9GP68';

  console.log(`Copying from ${sourceCode} to ${targetCode}...`);

  // 1. Get source shop ID
  let { data: sourceShop, error: err1 } = await supabase.from('shops').select('id').eq('shop_code', sourceCode).single();
  if (err1 || !sourceShop) {
      console.error(`Source shop ${sourceCode} not found or RLS blocked.`, err1);
      return;
  }
  const sourceShopId = sourceShop.id;

  // 2. Get target shop ID
  let { data: targetShop, error: err2 } = await supabase.from('shops').select('id').eq('shop_code', targetCode).single();
  if (err2 || !targetShop) {
      console.error(`Target shop ${targetCode} not found or RLS blocked.`, err2);
      return;
  }
  const targetShopId = targetShop.id;

  console.log(`Source Shop ID: ${sourceShopId}`);
  console.log(`Target Shop ID: ${targetShopId}`);

  // 3. Fetch source service_groups
  let { data: sourceGroups, error: err3 } = await supabase.from('service_groups').select('*').eq('shop_id', sourceShopId);
  if (err3) {
      console.error('Error fetching source groups:', err3);
      return;
  }
  console.log(`Found ${sourceGroups?.length || 0} service groups.`);

  // 4. Fetch source services
  let { data: sourceServices, error: err4 } = await supabase.from('services').select('*').eq('shop_id', sourceShopId);
  if (err4) {
      console.error('Error fetching source services:', err4);
      return;
  }
  console.log(`Found ${sourceServices?.length || 0} services.`);

  const groupIdMap = {};

  // 5. Insert service groups to target
  if (sourceGroups && sourceGroups.length > 0) {
      for (const group of sourceGroups) {
          const { data: newGroup, error } = await supabase.from('service_groups').insert({
              shop_id: targetShopId,
              name: group.name,
              sort_order: group.sort_order
          }).select().single();

          if (error) {
              console.error('Error inserting group:', group.name, error);
          } else {
              groupIdMap[group.id] = newGroup.id;
              console.log(`Copied group: ${group.name}`);
          }
      }
  }

  // 6. Insert services to target
  if (sourceServices && sourceServices.length > 0) {
      for (const service of sourceServices) {
          const newGroupId = service.service_group_id ? groupIdMap[service.service_group_id] : null;

          const { data: newService, error } = await supabase.from('services').insert({
              shop_id: targetShopId,
              name: service.name,
              price: service.price,
              duration_minutes: service.duration_minutes,
              commission_type: service.commission_type,
              commission_value: service.commission_value,
              service_group_id: newGroupId
          }).select().single();

          if (error) {
              console.error('Error inserting service:', service.name, error);
          } else {
              console.log(`Copied service: ${service.name}`);
          }
      }
  }

  console.log('Copy completed.');
}

run();
