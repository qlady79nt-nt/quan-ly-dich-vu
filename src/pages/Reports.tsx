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
import { createPortal } from 'react-dom';

const Reports = () => {
  const { hasPermission, profile } = useAuth();
  const shopId = profile?.shop_id;

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [view, setView] = useState<'revenue' | 'commission'>('revenue');
  const [detailModal, setDetailModal] = useState<any>(null);
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalComm: 0,
    totalCashFlow: 0
  });

  useEffect(() => {
    if (shopId) fetchReportData();
  }, [shopId, startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Check Permissions before fetching
      const canViewRevenue = hasPermission('report.revenue.view');
      const canViewCommissions = hasPermission('report.commission.view');

      let revLog: any[] = [];
      let pkgSales: any[] = [];
      let commLog: any[] = [];

      const start = `${startDate}T00:00:00.000Z`;
      const end = `${endDate}T23:59:59.999Z`;

      if (canViewRevenue) {
        const { data } = await supabase.from('revenue_logs').select('*').eq('shop_id', shopId).gte('created_at', start).lte('created_at', end);
        revLog = data || [];
        
        const { data: ps } = await supabase.from('package_sales').select('*').eq('shop_id', shopId).gte('created_at', start).lte('created_at', end);
        pkgSales = ps || [];
      }

      if (canViewCommissions) {
        const { data: commData, error } = await supabase.from('commission_logs').select('*').eq('shop_id', shopId).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false });
        
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



      // Fetch retail items for staff revenue calculation
      let retailItems: any[] = [];
      if (canViewRevenue) {
         // Because we no longer fetch all invoices by default if we removed the invoices tab, we need to explicitly fetch them for the date range
         const { data: invs } = await supabase.from('invoices').select('id').eq('shop_id', shopId).gte('created_at', start).lte('created_at', end);
         if (invs && invs.length > 0) {
            const invIds = invs.map(i => i.id);
            const { data: items } = await supabase.from('invoice_items').select('*').in('invoice_id', invIds).eq('type', 'retail');
            if (items) retailItems = items;
         }
      }

      // Calculations
      const retailRev = revLog.filter((r: any) => r.type === 'retail').reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const packageSessionRev = revLog.filter((r: any) => r.type === 'package_session').reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const packageSaleCash = revLog.filter((r: any) => r.type === 'package_sale').reduce((acc: number, r: any) => acc + Number(r.amount), 0);

      const totalRev = retailRev + packageSessionRev;
      const totalCashFlow = retailRev + packageSaleCash;
      
      const totalCost = revLog.reduce((acc: number, r: any) => acc + Number(r.cost || 0), 0);
      const totalComm = commLog.reduce((acc: number, c: any) => acc + Number(c.amount), 0);

      setStats({
        totalRevenue: totalRev,
        totalProfit: totalRev - totalCost - totalComm,
        totalComm: totalComm,
        totalCashFlow: totalCashFlow
      });

      setRevenueData(revLog);

      const staffMap: any = {};
      commLog.forEach((c: any) => {
        const id = c.staff_id;
        const name = c.profiles?.full_name || 'N/A';
        if (!staffMap[id]) staffMap[id] = { id, name, execution: 0, sales: 0, logs: [], revenueGenerated: 0 };
        if (c.type === 'service_execution') staffMap[id].execution += Number(c.amount);
        if (c.type === 'package_sale' || c.type === 'retail') staffMap[id].sales += Number(c.amount);
        staffMap[id].logs.push(c);
      });
      
      pkgSales.forEach((ps: any) => {
        if (ps.seller_id && staffMap[ps.seller_id]) {
          staffMap[ps.seller_id].revenueGenerated += Number(ps.amount_paid);
        }
      });
      retailItems.forEach((ri: any) => {
        if (ri.staff_id && staffMap[ri.staff_id]) {
          staffMap[ri.staff_id].revenueGenerated += Number(ri.final_price || ri.price);
        }
      });

      setStaffData(Object.values(staffMap));

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const openRevenueDetail = async (log: any) => {
    setLoading(true);
    try {
      if (log.type === 'retail') {
        const { data: inv } = await supabase.from('invoices').select('*, profiles:created_by(full_name)').eq('id', log.reference_id).single();
        const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', log.reference_id);
        setDetailModal({ 
          type: 'invoice', 
          data: { ...inv, staff_name: inv?.profiles?.full_name || 'Thu ngân', items: items || [] }, 
          title: `Hoá đơn #${log.reference_id?.slice(0,8) || 'N/A'}` 
        });
      } else if (log.type === 'package_sale') {
        const { data: sale } = await supabase.from('package_sales').select('*').eq('id', log.reference_id).single();
        if (sale && sale.customer_package_id) {
          const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', sale.customer_package_id).single();
          const { data: prof } = sale.seller_id ? await supabase.from('profiles').select('full_name').eq('id', sale.seller_id).single() : { data: null };
          if (cp) {
            const { data: pkg } = await supabase.from('packages').select('name').eq('id', cp.package_id).single();
            setDetailModal({ 
              type: 'package_sale', 
              data: { ...sale, customer: cp, packageName: pkg?.name || 'Gói không xác định', staff_name: prof?.full_name || 'Thu ngân / Người bán' }, 
              title: `Chi tiết Bán liệu trình` 
            });
            return;
          }
        }
        setDetailModal({ type: 'generic', data: sale || { message: 'Không tìm thấy dữ liệu' }, title: `Chi tiết Bán gói` });
      } else if (log.type === 'package_session') {
        const { data: sess } = await supabase.from('service_sessions').select('*').eq('id', log.reference_id).single();
        if (sess && sess.customer_package_id) {
          const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', sess.customer_package_id).single();
          const { data: prof } = sess.staff_id ? await supabase.from('profiles').select('full_name').eq('id', sess.staff_id).single() : { data: null };
          if (cp) {
            const { data: pkg } = await supabase.from('packages').select('name').eq('id', cp.package_id).single();
            setDetailModal({ 
              type: 'package_session', 
              data: { ...sess, customer: cp, packageName: pkg?.name || 'Gói không xác định', staff_name: prof?.full_name || 'Kỹ thuật viên' }, 
              title: `Chi tiết Trừ buổi liệu trình` 
            });
            return;
          }
        }
        setDetailModal({ type: 'generic', data: sess || { message: 'Không tìm thấy dữ liệu' }, title: `Chi tiết Trừ buổi` });
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !detailModal) return <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Báo cáo Tổng hợp</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Theo dõi dòng tiền, doanh thu và hiệu suất</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Từ:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: '500' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Đến:</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: '500' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setView('revenue')} className="btn" style={{ background: view === 'revenue' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'revenue' ? 'white' : 'inherit' }}>
          <TrendingUp size={18} /> Doanh thu
        </button>
        <button onClick={() => setView('commission')} className="btn" style={{ background: view === 'commission' ? 'var(--primary)' : 'var(--bg-main)', color: view === 'commission' ? 'white' : 'inherit' }}>
          <Users size={18} /> Hoa hồng nhân viên
        </button>
      </div>
      
      {view === 'revenue' && (
        <>
          {hasPermission('report.revenue.view') ? (
            <>
              <div className="grid grid-cols-3" style={{ marginBottom: '2rem' }}>
                <div className="premium-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Thực thu (Tiền mặt Cashflow)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalCashFlow.toLocaleString()}đ</div>
                </div>
                <div className="premium-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Doanh thu dịch vụ (Nhận diện)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{stats.totalRevenue.toLocaleString()}đ</div>
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
                    <div 
                      key={idx} 
                      onClick={() => openRevenueDetail(r)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s', borderRadius: '0.5rem' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '0.875rem' }}>{r.type === 'retail' ? 'Lẻ' : r.type === 'package_sale' ? 'Bán gói' : 'Dùng gói'} - {new Date(r.recorded_at).toLocaleDateString()}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ color: 'var(--success)' }}>+{Number(r.amount).toLocaleString()}đ</strong>
                        <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                      </div>
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
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}><Users size={20} /> Chi tiết Hoa hồng Nhân viên</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {staffData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)', background: 'var(--bg-main)', borderRadius: '1rem' }}>
                      Không có dữ liệu hoa hồng trong khoảng thời gian này
                    </div>
                  ) : (
                    staffData.map(s => (
                      <div key={s.id} style={{ background: 'var(--bg-main)', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '0.5rem' }}>{s.name}</h3>
                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              <span>Thực hiện: <strong>{s.execution.toLocaleString()}đ</strong></span>
                              <span>Bán hàng: <strong>{s.sales.toLocaleString()}đ</strong></span>
                              <span style={{ color: 'var(--success)' }}>Doanh số Thực thu: <strong>{Number(s.revenueGenerated || 0).toLocaleString()}đ</strong></span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tổng hoa hồng</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{(s.execution + s.sales).toLocaleString()}đ</div>
                          </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '0.75rem 0.5rem', width: '20%' }}>Ngày/Giờ</th>
                              <th style={{ padding: '0.75rem 0.5rem', width: '30%' }}>Nghiệp vụ / Dịch vụ</th>
                              <th style={{ padding: '0.75rem 0.5rem', width: '20%' }}>Mã Phiếu/HĐ</th>
                              <th style={{ padding: '0.75rem 0.5rem', width: '15%' }}>Loại</th>
                              <th style={{ padding: '0.75rem 0.5rem', width: '15%', textAlign: 'right' }}>Hoa hồng nhận</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.logs.map((log: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(log.created_at).toLocaleString()}</td>
                                <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{log.note || 'Thực hiện dịch vụ'}</td>
                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                  <button 
                                    onClick={() => openRevenueDetail(log)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    #{log.reference_id?.slice(0,8)} <FileText size={12} />
                                  </button>
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                  <span className={`badge ${log.type === 'package_sale' || log.type === 'retail' ? 'badge-primary' : 'badge-success'}`}>
                                    {log.type === 'package_sale' || log.type === 'retail' ? 'Bán hàng' : 'Thực hiện'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                                  +{Number(log.amount).toLocaleString()}đ
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
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

      {/* DETAIL MODAL */}
      {detailModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              {detailModal.title}
            </h3>
            
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.5rem' }}>
              {detailModal.type === 'invoice' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày tạo:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Sản phẩm / Dịch vụ</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    {detailModal.data.items?.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span>{item.name || item.service_name || 'Dịch vụ'}</span>
                        <span>{Number(item.price || item.unit_price).toLocaleString()}đ</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>
                      <span>Tổng cộng:</span>
                      <span>{Number(detailModal.data.final_amount).toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'staff_comm' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1, background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Thực hiện</div>
                      <div style={{ fontWeight: '700' }}>{Number(detailModal.data.execution).toLocaleString()}đ</div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Bán gói</div>
                      <div style={{ fontWeight: '700' }}>{Number(detailModal.data.sales).toLocaleString()}đ</div>
                    </div>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Chi tiết các lượt ({detailModal.data.logs.length})</h4>
                  {detailModal.data.logs.map((c: any, idx: number) => (
                    <div key={idx} style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '0.5rem', borderLeft: c.type === 'package_sale' ? '3px solid var(--secondary)' : '3px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{c.type === 'package_sale' ? 'Bán liệu trình' : 'Dùng liệu trình'}</span>
                        <span style={{ color: 'var(--primary)', fontWeight: '700' }}>+{Number(c.amount).toLocaleString()}đ</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c.note || 'N/A'}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detailModal.type === 'package_sale' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.customer_phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã thẻ:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.card_code || 'Không có'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày mua:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Sản phẩm / Dịch vụ</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>Gói: {detailModal.data.packageName}</span>
                      <span>{Number(detailModal.data.amount_paid).toLocaleString()}đ</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <span>Tổng số buổi:</span>
                      <span>{detailModal.data.customer?.total_sessions} buổi</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>
                      <span>Tổng thanh toán:</span>
                      <span>{Number(detailModal.data.amount_paid).toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'package_session' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.customer_name || 'Khách lẻ'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.customer_phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mã thẻ:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.customer?.card_code || 'Không có'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nhân viên:</span>
                    <span style={{ fontWeight: '600' }}>{detailModal.data.staff_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ngày dùng:</span>
                    <span>{new Date(detailModal.data.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Sản phẩm / Dịch vụ</h4>
                  <div style={{ background: 'var(--bg-main)', borderRadius: '0.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>Trừ 1 buổi: {detailModal.data.packageName}</span>
                      <span>-</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span>Tổng số buổi gói:</span>
                      <span>{detailModal.data.customer?.total_sessions} buổi</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span>Đã sử dụng:</span>
                      <span>{detailModal.data.customer?.used_sessions} buổi</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--primary)', marginTop: '0.5rem' }}>
                      <span>Còn lại:</span>
                      <span>{detailModal.data.customer?.total_sessions - detailModal.data.customer?.used_sessions} buổi</span>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.type === 'generic' && (
                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.875rem', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                  {JSON.stringify(detailModal.data, null, 2)}
                </div>
              )}
            </div>
            
            <button onClick={() => setDetailModal(null)} className="btn" style={{ background: 'var(--bg-main)', width: '100%' }}>Đóng</button>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default Reports;
