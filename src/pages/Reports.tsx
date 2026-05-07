import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Loader2,
  FileText,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Reports = () => {
  const { hasPermission, profile } = useAuth();
  const shopId = profile?.shop_id;

  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [view, setView] = useState<'revenue' | 'commission' | 'invoices'>('revenue');
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalComm: 0,
    totalCashFlow: 0
  });

  useEffect(() => {
    if (shopId) fetchReportData();
  }, [shopId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Check Permissions before fetching
      const canViewRevenue = hasPermission('report.revenue.view');
      const canViewCommissions = hasPermission('report.commission.view');
      const canViewInvoices = hasPermission('report.invoice.view');

      let revLog: any[] = [];
      let pkgSales: any[] = [];
      let commLog: any[] = [];
      let invList: any[] = [];

      if (canViewRevenue) {
        const { data } = await supabase.from('revenue_logs').select('*').eq('shop_id', shopId);
        revLog = data || [];
        
        const { data: ps } = await supabase.from('package_sales').select('amount_paid').eq('shop_id', shopId);
        pkgSales = ps || [];
      }

      if (canViewCommissions) {
        const { data: commData, error } = await supabase.from('commission_logs').select('*').eq('shop_id', shopId);
        
        if (error) {
          console.error('Lỗi tải hoa hồng:', error);
        } else if (commData && commData.length > 0) {
          const staffIds = [...new Set(commData.map(c => c.staff_id).filter(Boolean))];
          let profilesData: any[] = [];
          if (staffIds.length > 0) {
            const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', staffIds);
            if (profs) profilesData = profs;
          }
          
          commLog = commData.map(c => ({
            ...c,
            profiles: profilesData.find(p => p.id === c.staff_id) || { full_name: 'Nhân viên (Đã xoá)' }
          }));
        }
      }

      if (canViewInvoices) {
        const { data: invData, error } = await supabase.from('invoices').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
        
        if (error) {
          console.error('Lỗi tải hoá đơn:', error);
        } else if (invData && invData.length > 0) {
          const creatorIds = [...new Set(invData.map(i => i.created_by).filter(Boolean))];
          let profilesData: any[] = [];
          if (creatorIds.length > 0) {
            const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds);
            if (profs) profilesData = profs;
          }
          
          invList = invData.map(i => ({
            ...i,
            profiles: profilesData.find(p => p.id === i.created_by) || { full_name: 'Nhân viên (Đã xoá)' }
          }));
          setInvoices(invList);
        }
      }

      // Calculations
      const retailRev = revLog.filter((r: any) => r.type === 'retail').reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const packageCash = pkgSales.reduce((acc: number, p: any) => acc + Number(p.amount_paid), 0);
      const totalRev = revLog.reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const totalCost = revLog.reduce((acc: number, r: any) => acc + Number(r.cost), 0);
      const totalComm = commLog.reduce((acc: number, c: any) => acc + Number(c.amount), 0);

      setStats({
        totalRevenue: totalRev,
        totalProfit: totalRev - totalCost - totalComm,
        totalComm: totalComm,
        totalCashFlow: retailRev + packageCash
      });

      setRevenueData(revLog);

      const staffMap: any = {};
      commLog.forEach((c: any) => {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Báo cáo & Hoá đơn</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Thống kê hiệu quả kinh doanh</p>
        </div>
        <div className="premium-card" style={{ padding: '0.25rem', display: 'flex', gap: '0.25rem' }}>
          <button onClick={() => setView('revenue')} className="btn" style={{ background: view === 'revenue' ? 'var(--primary)' : 'transparent', color: view === 'revenue' ? 'white' : 'var(--text-secondary)', fontSize: '0.75rem' }}>Báo cáo Doanh thu</button>
          <button onClick={() => setView('commission')} className="btn" style={{ background: view === 'commission' ? 'var(--primary)' : 'transparent', color: view === 'commission' ? 'white' : 'var(--text-secondary)', fontSize: '0.75rem' }}>Báo cáo Hoa hồng</button>
          <button onClick={() => setView('invoices')} className="btn" style={{ background: view === 'invoices' ? 'var(--primary)' : 'transparent', color: view === 'invoices' ? 'white' : 'var(--text-secondary)', fontSize: '0.75rem' }}>Danh sách hoá đơn</button>
        </div>
      </div>

      {view === 'revenue' && (
        <>
          {hasPermission('report.revenue.view') ? (
            <>
              <div className="grid grid-cols-3" style={{ marginBottom: '2rem' }}>
                <div className="premium-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Doanh thu thực tế</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalRevenue.toLocaleString()}đ</div>
                </div>
                <div className="premium-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cashflow (Tiền mặt)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalCashFlow.toLocaleString()}đ</div>
                </div>
                <div className="premium-card" style={{ borderLeft: '4px solid var(--success)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Lợi nhuận ròng</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalProfit.toLocaleString()}đ</div>
                </div>
              </div>

              <div className="premium-card">
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}><TrendingUp size={20} /> Nhật ký Doanh thu</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {revenueData.slice(0, 20).map((r, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.875rem' }}>{r.type === 'retail' ? 'Lẻ' : 'Gói'} - {new Date(r.recorded_at).toLocaleDateString()}</span>
                      <strong style={{ color: 'var(--success)' }}>+{Number(r.amount).toLocaleString()}đ</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="premium-card" style={{ textAlign: 'center', padding: '5rem' }}>
              <Lock size={48} style={{ color: 'var(--text-light)', marginBottom: '1rem' }} />
              <h3>Bạn không có quyền xem báo cáo doanh thu</h3>
            </div>
          )}
        </>
      )}

      {view === 'commission' && (
        <>
          {hasPermission('report.commission.view') ? (
            <>
              <div className="grid grid-cols-1" style={{ marginBottom: '2rem' }}>
                <div className="premium-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tổng Hoa hồng chi trả</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--warning)' }}>{stats.totalComm.toLocaleString()}đ</div>
                </div>
              </div>

              <div className="premium-card">
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}><Users size={20} /> Bảng thống kê Hoa hồng Nhân viên</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {staffData.map((s, idx) => (
                    <div key={idx} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '700' }}>
                        <span>{s.name}</span>
                        <span style={{ color: 'var(--primary)' }}>{(s.execution + s.sales).toLocaleString()}đ</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Thực hiện: {s.execution.toLocaleString()}đ</span>
                        <span>Bán gói: {s.sales.toLocaleString()}đ</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="premium-card" style={{ textAlign: 'center', padding: '5rem' }}>
              <Lock size={48} style={{ color: 'var(--text-light)', marginBottom: '1rem' }} />
              <h3>Bạn không có quyền xem báo cáo hoa hồng</h3>
            </div>
          )}
        </>
      )}

      {view === 'invoices' && (
        <div className="premium-card animate-fade">
          {hasPermission('report.invoice.view') ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem' }}>Mã HĐ</th>
                  <th>Khách hàng</th>
                  <th>Ngày tạo</th>
                  <th>Người tạo</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>#{inv.id.slice(0,8)}</td>
                    <td>{inv.customer_name || 'Khách lẻ'}</td>
                    <td>{new Date(inv.created_at).toLocaleString()}</td>
                    <td>{inv.profiles?.full_name}</td>
                    <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{Number(inv.final_amount).toLocaleString()}đ</td>
                    <td>
                      <span className={`badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                        {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'cancelled' ? 'Đã huỷ' : 'Chờ thanh toán'}
                      </span>
                    </td>
                    <td><button onClick={() => alert('Chức năng xem chi tiết hoá đơn đang được phát triển')} className="btn" style={{ padding: '0.4rem', background: 'var(--bg-main)' }}><FileText size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem' }}>Bạn không có quyền xem danh sách hoá đơn</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
