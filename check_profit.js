import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrzgpyctnniorxcqjooz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyemdweWN0bm5pb3J4Y3Fqb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjY0MjgsImV4cCI6MjA5MzQ0MjQyOH0.CaAe6jS04xi5mUo2r37_ImI1BDS88sCsjipCftt6Pt0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: shops } = await supabase.from('shops').select('id, shop_code');
  const shop = shops.find(s => s.shop_code && s.shop_code.toUpperCase() === 'SPA-9OIFRM');
  
  if (!shop) {
    console.log('Shop not found. Available shops:', shops.map(s => s.shop_code).join(', '));
    return;
  }
  const shopId = shop.id;
  
  const { data: revLog } = await supabase.from('revenue_logs').select('*').eq('shop_id', shopId);
  const { data: commLog } = await supabase.from('commission_logs').select('*').eq('shop_id', shopId);
  
  const retailRev = revLog.filter(r => r.type === 'retail' || r.type === 'combo').reduce((acc, r) => acc + Number(r.amount), 0);
  const packageSessionRev = revLog.filter(r => r.type === 'package_session').reduce((acc, r) => acc + Number(r.amount), 0);
  const totalRev = retailRev + packageSessionRev;
  
  const totalCost = revLog.reduce((acc, r) => acc + Number(r.cost || 0), 0);
  const totalComm = commLog.reduce((acc, c) => acc + Number(c.amount || 0), 0);
  
  const totalProfit = totalRev - totalCost - totalComm;
  
  console.log('Shop ID:', shopId);
  console.log('Retail & Combo Rev:', retailRev);
  console.log('Package Session Rev:', packageSessionRev);
  console.log('Total Rev:', totalRev);
  console.log('Total Cost:', totalCost);
  console.log('Total Comm:', totalComm);
  console.log('Total Profit:', totalProfit);
  console.log('Profit =', totalRev, '-', totalCost, '-', totalComm, '=', totalProfit);
  
  const topCosts = [...revLog].sort((a,b) => Number(b.cost) - Number(a.cost)).slice(0, 3);
  console.log('\nTop 3 costs:');
  topCosts.forEach(c => console.log(`Cost: ${c.cost}, Amount: ${c.amount}, Type: ${c.type}`));
  
  const topComms = [...commLog].sort((a,b) => Number(b.amount) - Number(a.amount)).slice(0, 3);
  console.log('\nTop 3 commissions:');
  topComms.forEach(c => console.log(`Comm: ${c.amount}, Type: ${c.type}`));
}
run();
