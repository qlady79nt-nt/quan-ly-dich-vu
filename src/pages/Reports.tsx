import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Wallet, 
  Loader2,
  DollarSign,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Reports = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalComm: 0,
    totalCashFlow: 0 // Tiền mặt thu về thực tế (bao gồm bán gói)
  });

  useEffect(() => {
    if (shopId) fetchReportData();
  }, [shopId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // 1. Lấy Log Doanh thu thực tế (đã làm dịch vụ)
      const { data: revLog } = await supabase.from('revenue_logs').select('*').eq('shop_id', shopId);
      
      // 2. Lấy Log Tiền mặt thu về (Package Sales + Retail)
      const { data: pkgSales } = await supabase.from('package_sales').select('amount_paid').eq('shop_id', shopId);
      const retailRev = (revLog || []).filter((r: any) => r.type === 'retail').reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const packageCash = (pkgSales || []).reduce((acc: number, p: any) => acc + Number(p.amount_paid), 0);

      // 3. Lấy Log Hoa hồng
      const { data: commLog } = await supabase.from('commission_logs').select('*, profiles(full_name)').eq('shop_id', shopId);

      // Tính toán stats
      const totalRev = (revLog || []).reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const totalCost = (revLog || []).reduce((acc: number, r: any) => acc + Number(r.cost), 0);
      const totalComm = (commLog || []).reduce((acc: number, c: any) => acc + Number(c.amount), 0);

      setStats({
        totalRevenue: totalRev,
        totalProfit: totalRev - totalCost - totalComm,
        totalComm: totalComm,
        totalCashFlow: retailRev + packageCash
      });

      setRevenueData(revLog || []);

      // Group staff data
      const staffMap: any = {};
      (commLog || []).forEach((c: any) => {
        const name = c.profiles?.full_name || 'N/A';
        if (!staffMap[name]) staffMap[name] = { name, execution: 0, sales: 0 };
        if (c.type === 'service_execution') staffMap[name].execution += Number(c.amount);
        if (c.type === 'package_sale') staffMap[name].sales += Number(c.amount);
      });
      setStaffData(Object.values(staffMap));

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Báo cáo Tài chính</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Doanh thu thực tế và hiệu quả kinh doanh</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4" style={{ marginBottom: '2rem' }}>
        <div className="premium-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(109, 40, 217, 0.1)', borderRadius: '0.5rem', color: 'var(--primary)' }}><DollarSign size={20} /></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center' }}><ArrowUpRight size={14} /> +12%</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Doanh thu thực tế</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalRevenue.toLocaleString()}đ</div>
        </div>

        <div className="premium-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(212, 175, 55, 0.1)', borderRadius: '0.5rem', color: 'var(--secondary)' }}><Wallet size={20} /></div>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Dòng tiền thu về (Cashflow)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalCashFlow.toLocaleString()}đ</div>
        </div>

        <div className="premium-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', color: 'var(--success)' }}><TrendingUp size={20} /></div>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Lợi nhuận ròng</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalProfit.toLocaleString()}đ</div>
        </div>

        <div className="premium-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '0.5rem', color: 'var(--warning)' }}><Users size={20} /></div>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tổng hoa hồng chi trả</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalComm.toLocaleString()}đ</div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        {/* Báo cáo theo nhân viên */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} color="var(--primary)" /> Hiệu suất và Hoa hồng Nhân viên
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {staffData.map((s, idx) => (
              <div key={idx} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: '700' }}>{s.name}</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{(s.execution + s.sales).toLocaleString()}đ</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    HH Làm dịch vụ: <br/> <strong style={{ color: 'var(--text-primary)' }}>{s.execution.toLocaleString()}đ</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    HH Bán liệu trình: <br/> <strong style={{ color: 'var(--text-primary)' }}>{s.sales.toLocaleString()}đ</strong>
                  </div>
                </div>
              </div>
            ))}
            {staffData.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-light)' }}>Chưa có dữ liệu nhân viên</p>}
          </div>
        </div>

        {/* Lịch sử doanh thu gần đây */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="var(--success)" /> Nhật ký Doanh thu (Theo dịch vụ)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {revenueData.slice(0, 10).map((r, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{r.type === 'retail' ? 'Dịch vụ lẻ' : 'Trừ buổi liệu trình'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{new Date(r.recorded_at).toLocaleString('vi-VN')}</div>
                </div>
                <div style={{ fontWeight: '700', color: 'var(--success)' }}>+{Number(r.amount).toLocaleString()}đ</div>
              </div>
            ))}
            {revenueData.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-light)' }}>Chưa có giao dịch doanh thu nào</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
