import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Loader2,
  FileText,
  Lock,
  Search
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
  const [revenueTab, setRevenueTab] = useState<'all' | 'retail' | 'package_sale' | 'package_session'>('all');
  const [detailModal, setDetailModal] = useState<any>(null);
  
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

      let revLog: any[] = [];
      let commLog: any[] = [];

      const startObj = new Date(startDate + 'T00:00:00');
      const endObj = new Date(endDate + 'T23:59:59.999');
      const start = startObj.toISOString();
      const end = endObj.toISOString();

      if (canViewRevenue) {
        const { data, error } = await supabase.from('revenue_logs').select('*').eq('shop_id', shopId).gte('recorded_at', start).lte('recorded_at', end);
        if (error) console.error('Lỗi tải revenue_logs:', error);
        revLog = data || [];
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



      let retailItems: any[] = [];
      
      // Fetch related entities by IDs found in revLog (TRÁNH LỖI LỆCH NGÀY GIỜ VÀ HỖ TRỢ DỮ LIỆU CŨ)
      let relatedInvoices: any[] = [];
      let relatedPkgSales: any[] = [];
      let relatedSessions: any[] = [];
      
      // Lấy danh sách ID Hóa đơn cần fetch:
      // Bao gồm 'retail' và cả 'package_sale' cũ (trước kia dùng reference_id lưu invoice_id)
      const invIdsToFetch = [...new Set(revLog.filter((r: any) => r.type === 'retail' || (r.type === 'package_sale' && !r.package_sale_id)).map((r: any) => r.invoice_id || r.reference_id).filter(Boolean))];
      const psIds = [...new Set(revLog.filter((r: any) => r.type === 'package_sale' && r.package_sale_id).map((r: any) => r.package_sale_id).filter(Boolean))];
      const ssIds = [...new Set(revLog.filter((r: any) => r.type === 'package_session').map((r: any) => r.service_session_id || r.reference_id).filter(Boolean))];

      if (invIdsToFetch.length > 0) {
         const { data: invs } = await supabase.from('invoices').select('id, customer_id, customer_name, customers(name)').in('id', invIdsToFetch);
         if (invs) {
            relatedInvoices = invs;
            const { data: items } = await supabase.from('invoice_items').select('*').in('invoice_id', invIdsToFetch).eq('type', 'retail');
            if (items) retailItems = items;
         }
      }
      
      if (psIds.length > 0) {
         const { data: psData } = await supabase.from('package_sales').select('*, customer_packages(customer_name)').in('id', psIds);
         if (psData) relatedPkgSales = psData;
      }

      if (ssIds.length > 0) {
         const { data: ssData } = await supabase.from('service_sessions').select('id, customer_package_id, customer_packages(customer_name)').in('id', ssIds);
         if (ssData) relatedSessions = ssData;
      }

      // Calculations (dùng revLog gốc)
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

      // Gắn invoice_id và customer_name vào revenue_logs để hiển thị trực tiếp trên danh sách
      const mappedRevLogs = revLog.map((r: any) => {
        let invId: string | null = null;
        let cName = 'Khách lẻ';
        let sessId: string | null = null;
        
        if (r.type === 'retail') {
           invId = r.invoice_id || r.reference_id;
           const inv = relatedInvoices.find(i => i.id === invId);
           if (inv) cName = inv.customers?.name || inv.customer_name || 'Khách lẻ';
        } else if (r.type === 'package_sale') {
           if (r.package_sale_id) {
               // Dữ liệu mới (sử dụng package_sale_id chuẩn)
               const ps = relatedPkgSales.find((p: any) => p.id === r.package_sale_id);
               if (ps) {
                 invId = ps.invoice_id;
                 if (ps.customer_packages?.customer_name) cName = ps.customer_packages.customer_name;
               }
           } else if (r.reference_id) {
               // Dữ liệu cũ (reference_id đang lưu invoice_id)
               invId = r.reference_id;
               const inv = relatedInvoices.find(i => i.id === invId);
               if (inv) cName = inv.customers?.name || inv.customer_name || 'Khách mua thẻ liệu trình';
           }
        } else if (r.type === 'package_session') {
           sessId = r.service_session_id || r.reference_id;
           const sess = relatedSessions.find(s => s.id === sessId);
           if (sess && sess.customer_packages) {
              cName = sess.customer_packages.customer_name || 'Khách thẻ';
              // Tìm invoice gốc thông qua relatedPkgSales hoặc fetch thêm nếu cần
              const ps = relatedPkgSales.find((p: any) => p.customer_package_id === sess.customer_package_id);
              if (ps) invId = ps.invoice_id;
           }
        }
        return { ...r, mapped_invoice_id: invId, mapped_session_id: sessId, customer_name: cName };
      });

      setRevenueData(mappedRevLogs);

      const staffMap: any = {};
      commLog.forEach((c: any) => {
        const id = c.staff_id;
        const name = c.profiles?.full_name || 'N/A';
        if (!staffMap[id]) staffMap[id] = { id, name, execution: 0, sales: 0, logs: [], revenueGenerated: 0 };
        if (c.type === 'service_execution') staffMap[id].execution += Number(c.amount);
        if (c.type === 'package_sale' || c.type === 'retail') staffMap[id].sales += Number(c.amount);
        staffMap[id].logs.push(c);
      });
      
      relatedPkgSales.forEach((ps: any) => {
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
        const idToLook = log.invoice_id || log.reference_id;
        const { data: inv } = await supabase.from('invoices').select('*, profiles:created_by(full_name)').eq('id', idToLook).single();
        const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', idToLook);
        setDetailModal({ 
          type: 'invoice', 
          data: { ...inv, staff_name: inv?.profiles?.full_name || 'Thu ngân', items: items || [] }, 
          title: `Hoá đơn #${idToLook?.slice(0,8) || 'N/A'}` 
        });
      } else if (log.type === 'package_sale') {
        const idToLook = log.package_sale_id || log.reference_id;
        const { data: sale } = await supabase.from('package_sales').select('*').eq('id', idToLook).single();
        if (sale && sale.customer_package_id) {
          const { data: cp } = await supabase.from('customer_packages').select('*').eq('id', sale.customer_package_id).single();
          const { data: prof } = sale.seller_id ? await supabase.from('profiles').select('full_name').eq('id', sale.seller_id).single() : { data: null };
          if (cp) {
            const { data: pkg } = await supabase.from('packages').select('name').eq('id', cp.package_id).single();
            setDetailModal({ 
              type: 'package_sale', 
              data: { ...sale, customer: cp, packageName: pkg?.name || 'Gói không xác định', staff_name: prof?.full_name || 'Thu ngân / Người bán' }, 
              title: sale.invoice_id ? `Chi tiết Bán liệu trình #${sale.invoice_id.slice(0,8)}` : `Chi tiết Bán liệu trình` 
            });
            return;
          }
        }
        setDetailModal({ type: 'generic', data: sale || { message: 'Không tìm thấy dữ liệu' }, title: `Chi tiết Bán gói` });
      } else if (log.type === 'package_session') {
        const idToLook = log.service_session_id || log.reference_id;
        const { data: sess } = await supabase.from('service_sessions').select('*').eq('id', idToLook).single();
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
          <button onClick={fetchReportData} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={16} /> Tìm kiếm
          </button>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} /> Nhật ký Doanh thu</h3>
                </div>

                {/* Sub-tabs cho Doanh thu */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  <button onClick={() => setRevenueTab('all')} className="btn" style={{ background: revenueTab === 'all' ? 'var(--primary)' : 'var(--bg-main)', color: revenueTab === 'all' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Tất cả</button>
                  <button onClick={() => setRevenueTab('retail')} className="btn" style={{ background: revenueTab === 'retail' ? 'var(--primary)' : 'var(--bg-main)', color: revenueTab === 'retail' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Dịch vụ lẻ</button>
                  <button onClick={() => setRevenueTab('package_sale')} className="btn" style={{ background: revenueTab === 'package_sale' ? 'var(--primary)' : 'var(--bg-main)', color: revenueTab === 'package_sale' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Bán liệu trình</button>
                  <button onClick={() => setRevenueTab('package_session')} className="btn" style={{ background: revenueTab === 'package_session' ? 'var(--primary)' : 'var(--bg-main)', color: revenueTab === 'package_session' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Sử dụng liệu trình (Trừ buổi)</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {revenueData.filter(r => revenueTab === 'all' || r.type === revenueTab).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', background: 'var(--bg-main)', borderRadius: '0.75rem' }}>
                      Không có phát sinh doanh thu loại này.
                    </div>
                  ) : (
                    revenueData.filter(r => revenueTab === 'all' || r.type === revenueTab).slice(0, 50).map((r, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => openRevenueDetail(r)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '0.75rem', background: 'var(--bg-main)' }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: r.type === 'retail' ? 'rgba(59, 130, 246, 0.1)' : r.type === 'package_sale' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.type === 'retail' ? '#3b82f6' : r.type === 'package_sale' ? 'var(--secondary)' : '#10b981' }}>
                            <FileText size={20} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>
                              {r.type === 'retail' ? 'Thu dịch vụ lẻ' : r.type === 'package_sale' ? 'Thu bán thẻ liệu trình' : 'Trừ buổi liệu trình'} 
                              
                              {/* Mã hóa đơn cho cả 3 loại */}
                              {r.mapped_invoice_id ? <span style={{ color: 'var(--primary)', marginLeft: '0.25rem' }}>HĐ: #{r.mapped_invoice_id.slice(0,6)}</span> : ''}
                              
                              {/* Mã phiếu trừ buổi riêng cho Sử dụng liệu trình */}
                              {r.type === 'package_session' && r.mapped_session_id ? <span style={{ color: 'var(--success)', marginLeft: '0.25rem' }}>Phiếu: #{r.mapped_session_id.slice(0,6)}</span> : ''}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{r.customer_name}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--border)' }}>•</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(r.recorded_at).toLocaleString('vi-VN')}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: '1.1rem', color: r.type === 'package_session' ? 'var(--primary)' : 'var(--success)' }}>
                            +{Number(r.amount).toLocaleString()}đ
                          </strong>
                        </div>
                      </div>
                    ))
                  )}
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
                  {detailModal.data.invoice_id && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mã Hóa Đơn:</span>
                      <span style={{ fontWeight: '600', color: 'var(--primary)' }}>#{detailModal.data.invoice_id.slice(0,8)}</span>
                    </div>
                  )}
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
