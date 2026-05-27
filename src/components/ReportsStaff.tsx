import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Briefcase, X, Scissors, ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReportsStaffProps {
  shopId: string;
  startDate: string;
  endDate: string;
}

const ReportsStaff = ({ shopId, startDate, endDate }: ReportsStaffProps) => {
  const [loading, setLoading] = useState(true);
  const [staffStats, setStaffStats] = useState<any[]>([]);
  const [debugCounts, setDebugCounts] = useState({ staffs: 0, sessions: 0, commissions: 0 });

  // States cho chi tiết KTV
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sessionsDetail, setSessionsDetail] = useState<any[]>([]);
  const [commissionsDetail, setCommissionsDetail] = useState<any[]>([]);
  const [activeModalTab, setActiveModalTab] = useState<'sessions' | 'commissions'>('sessions');

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString('vi-VN');
    } catch {
      return '---';
    }
  };

  const handleOpenDetail = async (staff: any) => {
    setSelectedStaff(staff);
    setIsModalOpen(true);
    setLoadingDetail(true);
    setActiveModalTab('sessions');

    try {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const startObj = new Date(sy, sm - 1, sd, 0, 0, 0);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endObj = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      const startStr = startObj.toISOString();
      const endStr = endObj.toISOString();

      // Fetch sessions (cuốc phục vụ) created in range
      const { data: createdSessions, error: sessErr } = await supabase
        .from('service_sessions')
        .select(`
          id,
          created_at,
          status,
          customer_package_id,
          services (name, price)
        `)
        .eq('staff_id', staff.id)
        .eq('status', 'completed')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false });

      if (sessErr) console.error('Lỗi lấy service_sessions chi tiết:', sessErr);

      // Fetch commission logs in range to find sessions checked out in range but created before
      const { data: commsInRange } = await supabase
        .from('commission_logs')
        .select('service_session_id')
        .eq('staff_id', staff.id)
        .in('type', ['service_execution', 'execution'])
        .neq('status', 'cancelled')
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      const additionalSessIds = commsInRange?.map(c => c.service_session_id).filter(id => id && !(createdSessions || []).find(s => s.id === id)) || [];
      
      let additionalSessions: any[] = [];
      if (additionalSessIds.length > 0) {
         const { data: addSess } = await supabase
           .from('service_sessions')
           .select(`
             id,
             created_at,
             status,
             customer_package_id,
             services (name, price)
           `)
           .eq('status', 'completed')
           .in('id', Array.from(new Set(additionalSessIds)));
         additionalSessions = addSess || [];
      }
      
      const sessions = [...(createdSessions || []), ...additionalSessions];

      const validSessIds = new Set(sessions?.map(s => s.id) || []);

      // ĐỌC TRỰC TIẾP TẤT CẢ HÓA ĐƠN QUA SERVICE_SESSION_ID (Bao gồm cả legacy)
      const { data: legacyCommsForIds } = await supabase
        .from('commission_logs')
        .select('service_session_id')
        .eq('staff_id', staff.id)
        .in('type', ['service_execution', 'execution'])
        .neq('status', 'cancelled')
        .gte('created_at', startStr)
        .lte('created_at', endStr);
        
      const allSessionIds = new Set([
        ...Array.from(validSessIds),
        ...(legacyCommsForIds || []).map(c => c.service_session_id).filter(Boolean)
      ]);

      // ĐỌC revenue_logs (Thay vì đọc cột từ service_sessions)
      const { data: sessRevenues, error: revErr } = await supabase
        .from('revenue_logs')
        .select('service_session_id, amount, invoice_id')
        .in('service_session_id', Array.from(allSessionIds));
        
      if (revErr) console.error('Lỗi lấy revenue_logs:', revErr);

      const revenueMap = new Map();
      const invoiceIdToSessMap = new Map();
      sessRevenues?.forEach(r => {
         const current = revenueMap.get(r.service_session_id) || 0;
         revenueMap.set(r.service_session_id, current + Number(r.amount));
         if (r.invoice_id) {
           invoiceIdToSessMap.set(r.invoice_id, r.service_session_id);
         }
      });

      const invoiceCodeMap = new Map();
      if (invoiceIdToSessMap.size > 0) {
        const { data: invs, error: invErr } = await supabase
          .from('invoices')
          .select('id, invoice_code')
          .in('id', Array.from(invoiceIdToSessMap.keys()));
          
        if (invErr) console.error('Lỗi lấy invoices:', invErr);
        
        invs?.forEach(inv => {
          const sId = invoiceIdToSessMap.get(inv.id);
          if (sId) invoiceCodeMap.set(sId, inv.invoice_code);
        });
      }

      // ĐỌC commission_logs cho session (Thay vì đọc cột từ service_sessions)
      const { data: sessComms } = await supabase
        .from('commission_logs')
        .select('service_session_id, amount')
        .eq('staff_id', staff.id)
        .in('type', ['service_execution', 'execution'])
        .neq('status', 'cancelled')
        .in('service_session_id', Array.from(allSessionIds));
        
      const commMap = new Map();
      sessComms?.forEach(c => {
         const current = commMap.get(c.service_session_id) || 0;
         commMap.set(c.service_session_id, current + Number(c.amount));
      });

      // TÌM THÔNG TIN CUSTOMER VÀ INVOICE CODE CHO PACKAGE SESSIONS (Liệu trình)
      const cpIds = (sessions || []).map(s => s.customer_package_id).filter(Boolean);
      const pkgCustomerNameMap = new Map();
      const pkgInvoiceCodeMap = new Map();
      
      if (cpIds.length > 0) {
        // Lấy tên khách hàng từ customer_packages
        const { data: cpData } = await supabase
          .from('customer_packages')
          .select('id, customer_name')
          .in('id', Array.from(new Set(cpIds)));
          
        if (cpData) {
          cpData.forEach(cp => {
            pkgCustomerNameMap.set(cp.id, cp.customer_name);
          });
        }

        // Lấy hóa đơn từ package_sales
        const { data: psData } = await supabase
          .from('package_sales')
          .select('customer_package_id, invoice_id')
          .in('customer_package_id', Array.from(new Set(cpIds)));
          
        if (psData && psData.length > 0) {
          const invIds = psData.map(ps => ps.invoice_id).filter(Boolean);
          if (invIds.length > 0) {
            const { data: invData } = await supabase
              .from('invoices')
              .select('id, invoice_code')
              .in('id', Array.from(new Set(invIds)));
              
            const invCodeMap = new Map();
            if (invData) {
              invData.forEach(inv => invCodeMap.set(inv.id, inv.invoice_code));
            }
            
            psData.forEach(ps => {
              if (ps.invoice_id && invCodeMap.has(ps.invoice_id)) {
                pkgInvoiceCodeMap.set(ps.customer_package_id, invCodeMap.get(ps.invoice_id));
              }
            });
          }
        }
      }

      const invoiceBySessionId: Record<string, any> = {};
      if (allSessionIds.size > 0) {
        const { data: allInvoices } = await supabase
          .from('invoices')
          .select('service_session_id, invoice_code, total_amount, customer_name')
          .in('service_session_id', Array.from(allSessionIds));
          
        allInvoices?.forEach(inv => {
          if (inv.service_session_id) {
            invoiceBySessionId[inv.service_session_id] = inv;
          }
        });
      }

      const enrichedSessions = (sessions || []).map(s => {
         const inv = invoiceBySessionId[s.id];
         const pkgCustomerName = s.customer_package_id ? pkgCustomerNameMap.get(s.customer_package_id) : null;
         
         return {
           ...s,
           revenue_amount: revenueMap.get(s.id) || (inv ? inv.total_amount : 0),
           commission_amount: commMap.get(s.id) || 0,
           invoice_code: s.customer_package_id ? (pkgInvoiceCodeMap.get(s.customer_package_id) || null) : (invoiceCodeMap.get(s.id) || inv?.invoice_code || null),
           // Ưu tiên tên khách từ liệu trình, sau đó đến nested (nếu có), cuối cùng là từ invoice
           customer_packages: pkgCustomerName ? { customer_name: pkgCustomerName } : (s.customer_packages || (inv?.customer_name ? { customer_name: inv.customer_name } : null))
         };
      });

      // Phục hồi dữ liệu cũ (Legacy) không có service_session_id hoặc id rác
      const { data: legacyComms } = await supabase
        .from('commission_logs')
        .select('id, created_at, amount, note, service_session_id')
        .eq('staff_id', staff.id)
        .in('type', ['service_execution', 'execution'])
        .neq('status', 'cancelled')
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      const legacySessions = (legacyComms || [])
        .filter(lc => !lc.service_session_id || !validSessIds.has(lc.service_session_id))
        .map(lc => {
          const inv = lc.service_session_id ? invoiceBySessionId[lc.service_session_id] : null;
          return {
            id: lc.service_session_id || lc.id,
            created_at: lc.created_at,
            revenue_amount: revenueMap.get(lc.service_session_id) || (inv ? inv.total_amount : 0), // Phục hồi doanh thu từ invoice map hoặc revenue_logs
            commission_amount: lc.amount,
            status: 'completed',
            services: { name: lc.note || 'Dịch vụ cũ (Đã thực hiện)' },
            customer_packages: inv?.customer_name ? { customer_name: inv.customer_name } : null,
            invoice_code: invoiceCodeMap.get(lc.service_session_id) || (inv ? inv.invoice_code : null)
          };
        });

      const allSessions = [...enrichedSessions, ...legacySessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSessionsDetail(allSessions);

      // Fetch other commission logs (Bán liệu trình hoặc hoa hồng khác)
      const { data: comms, error: commErr } = await supabase
        .from('commission_logs')
        .select('*, package_sales(amount_paid)')
        .eq('staff_id', staff.id)
        .neq('status', 'cancelled')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false });

      if (commErr) console.error('Lỗi lấy commission_logs chi tiết:', commErr);
      setCommissionsDetail(comms || []);

    } catch (err) {
      console.error('Lỗi truy vấn chi tiết nhân sự:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStaff(null);
    setSessionsDetail([]);
    setCommissionsDetail([]);
  };

  useEffect(() => {
    if (shopId && startDate && endDate) {
      fetchStaffStats();
    }
  }, [shopId, startDate, endDate]);

  const fetchStaffStats = async () => {
    setLoading(true);
    try {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const startObj = new Date(sy, sm - 1, sd, 0, 0, 0);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endObj = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      const startStr = startObj.toISOString();
      const endStr = endObj.toISOString();

      // BƯỚC 1: Fetch staffs
      const { data: staffs, error: staffsError } = await supabase
        .from('staffs')
        .select('id, full_name')
        .eq('shop_id', shopId);
        
      if (staffsError) console.error('Error fetching staffs:', staffsError);
        
      const staffList = staffs || [];
      const staffMap: Record<string, any> = {};
      
      // Fetch roles for staff members from profiles
      const { data: profileRoles, error: rolesErr } = await supabase
        .from('profiles')
        .select('staff_id, role')
        .eq('shop_id', shopId)
        .not('staff_id', 'is', null);
      
      if (rolesErr) console.error('Lỗi lấy role nhân viên:', rolesErr);
      
      const roleMap: Record<string, string> = {};
      if (profileRoles) {
        profileRoles.forEach(p => {
          if (p.staff_id) roleMap[p.staff_id] = p.role as string;
        });
      }
      
      staffList.forEach(s => {
        staffMap[s.id] = {
          id: s.id,
          name: s.full_name,
          role: roleMap[s.id] || 'staff', // default role if not found
          total_sessions: 0,
          total_revenue: 0, // DT Làm dịch vụ
          total_sales_revenue: 0, // DT Bán hàng
          sales_commission: 0,
          execution_commission: 0,
          other_commission: 0,
          total_commission: 0
        };
      });

      // BƯỚC 2: Fetch service_sessions (Tính cuốc & doanh thu dịch vụ) created in range
      const { data: createdSessions } = await supabase
        .from('service_sessions')
        .select('id, staff_id')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .gte('created_at', startStr)
        .lte('created_at', endStr);
        
      // Fetch commission logs in range to find sessions checked out in range but created before
      const { data: allCommsInRange } = await supabase
        .from('commission_logs')
        .select('service_session_id, staff_id, amount, type')
        .eq('shop_id', shopId)
        .neq('status', 'cancelled')
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      const additionalSessIds2 = allCommsInRange
        ?.filter(c => (c.type === 'service_execution' || c.type === 'execution') && c.service_session_id && !(createdSessions || []).find(s => s.id === c.service_session_id))
        .map(c => c.service_session_id) || [];

      let additionalSessions2: any[] = [];
      if (additionalSessIds2.length > 0) {
        const { data: addSess2 } = await supabase
          .from('service_sessions')
          .select('id, staff_id')
          .eq('status', 'completed')
          .in('id', Array.from(new Set(additionalSessIds2)));
        additionalSessions2 = addSess2 || [];
      }

      const sessions = [...(createdSessions || []), ...additionalSessions2];

      const validSessionIds = new Set<string>();
      const sessionStaffMap = new Map<string, string>();
      
      if (sessions) {
        sessions.forEach(sess => {
          validSessionIds.add(sess.id);
          if (sess.staff_id) {
            sessionStaffMap.set(sess.id, sess.staff_id);
            if (staffMap[sess.staff_id]) {
              staffMap[sess.staff_id].total_sessions += 1;
            }
          }
        });
      }

      // BƯỚC 2.5: Fetch revenue_logs linked to these sessions
      const { data: revLogs } = await supabase
        .from('revenue_logs')
        .select('service_session_id, amount')
        .in('service_session_id', Array.from(validSessionIds));

      if (revLogs) {
        revLogs.forEach(r => {
          const sId = sessionStaffMap.get(r.service_session_id);
          if (sId && staffMap[sId]) {
            staffMap[sId].total_revenue += Number(r.amount);
          }
        });
      }

      // BƯỚC 2.6: Fetch package_sales (Tính doanh thu bán hàng)
      const { data: pkgSales } = await supabase
        .from('package_sales')
        .select('seller_id, amount_paid')
        .eq('shop_id', shopId)
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      if (pkgSales) {
        pkgSales.forEach(sale => {
          if (sale.seller_id && staffMap[sale.seller_id]) {
            staffMap[sale.seller_id].total_sales_revenue += Number(sale.amount_paid || 0);
          }
        });
      }

      // BƯỚC 3: Tính hoa hồng từ allCommsInRange (đã fetch ở BƯỚC 2)
      const commissions = allCommsInRange;

      if (commissions) {
        commissions.forEach(c => {
          if (c.staff_id && staffMap[c.staff_id]) {
            staffMap[c.staff_id].total_commission += Number(c.amount || 0);
            if (c.type === 'package_sale' || c.type === 'retail' || c.type === 'sale') {
              staffMap[c.staff_id].sales_commission += Number(c.amount || 0);
            } else if (c.type === 'service_execution' || c.type === 'execution') {
              staffMap[c.staff_id].execution_commission += Number(c.amount || 0);
              // Phục hồi dữ liệu cũ: Nếu là hoa hồng thực hiện nhưng ko map được với session thực tế
              if (!c.service_session_id || !validSessionIds.has(c.service_session_id)) {
                staffMap[c.staff_id].total_sessions += 1;
              }
            } else {
              staffMap[c.staff_id].other_commission += Number(c.amount || 0);
            }
          }
        });
      }

      // BƯỚC 4: Lọc và sắp xếp
      const activeStaff = Object.values(staffMap)
        .filter(s => s.total_sessions > 0 || s.total_revenue > 0 || s.total_sales_revenue > 0 || s.total_commission > 0)
        .sort((a, b) => b.total_commission - a.total_commission);

      setStaffStats(activeStaff);
      
      setDebugCounts({
        staffs: staffList.length,
        sessions: sessions?.length || 0,
        commissions: commissions?.length || 0
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-card animate-fade" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Briefcase size={20} className="text-primary" /> Báo cáo Nhân viên
        </h3>
      </div>


      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin text-primary mx-auto" size={32} />
        </div>
      ) : staffStats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-main)', borderRadius: '1rem', color: 'var(--text-light)' }}>
          Không có dữ liệu nhân viên trong khoảng thời gian này
          <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            (Debug: Start: {startDate}, End: {endDate}, Staffs: {debugCounts.staffs}, Sessions: {debugCounts.sessions}, Commissions: {debugCounts.commissions})
          </div>
        </div>
      ) : (
        <>
        {/* DESKTOP/TABLET VIEW (TABLE) */}
        <div className="table-responsive hidden-mobile">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem' }}>Nhân viên</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>DT Bán gói</th>
                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)' }}>HH Bán hàng</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Số cuốc</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>DT Dịch vụ</th>
                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)' }}>HH Dịch vụ</th>
                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>Tổng HH</th>
              </tr>
            </thead>
            <tbody>
              {staffStats.map((staff) => (
                <tr 
                  key={staff.id} 
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-main)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => handleOpenDetail(staff)}
                  title="Nhấn để xem chi tiết lịch sử cuốc làm"
                >
                  <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {staff.name.charAt(0)}
                      </div>
                      {staff.name}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '500', color: 'var(--text-main)' }}>
                    {staff.total_sales_revenue.toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>
                    {staff.sales_commission.toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '700' }}>
                    <span style={{ background: 'rgba(109, 40, 217, 0.1)', color: 'var(--primary)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>
                      {staff.total_sessions}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '500', color: 'var(--text-main)' }}>
                    {staff.total_revenue.toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>
                    {staff.execution_commission.toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: 'var(--danger)' }}>
                    {staff.total_commission.toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-main)' }}>
                <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>TỔNG CỘNG</td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                  {staffStats.reduce((acc, s) => acc + s.total_sales_revenue, 0).toLocaleString()}đ
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: 'var(--success)' }}>
                  {staffStats.reduce((acc, s) => acc + s.sales_commission, 0).toLocaleString()}đ
                </td>
                <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '800', color: 'var(--primary)' }}>
                  {staffStats.reduce((acc, s) => acc + s.total_sessions, 0)}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                  {staffStats.reduce((acc, s) => acc + s.total_revenue, 0).toLocaleString()}đ
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: 'var(--primary)' }}>
                  {staffStats.reduce((acc, s) => acc + s.execution_commission, 0).toLocaleString()}đ
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: 'var(--danger)' }}>
                  {staffStats.reduce((acc, s) => acc + s.total_commission, 0).toLocaleString()}đ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* MOBILE VIEW (CARDS) */}
        <div className="visible-mobile">
          {staffStats.map((staff) => (
            <div 
              key={`card-${staff.id}`} 
              className="report-card"
              onClick={() => handleOpenDetail(staff)}
              style={{ cursor: 'pointer' }}
            >
              <div className="report-card-header">
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.25rem' }}>
                  {staff.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>{staff.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kỹ thuật viên / Bán hàng</div>
                </div>
              </div>
              
              <div className="report-card-row">
                <span style={{ color: 'var(--text-secondary)' }}>DT Bán gói</span>
                <span style={{ fontWeight: '500' }}>{staff.total_sales_revenue.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="report-card-row">
                <span style={{ color: 'var(--text-secondary)' }}>DT Dịch vụ</span>
                <span style={{ fontWeight: '500' }}>{staff.total_revenue.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="report-card-row">
                <span style={{ color: 'var(--text-secondary)' }}>HH Bán hàng</span>
                <span style={{ fontWeight: '600', color: 'var(--success)' }}>{staff.sales_commission.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="report-card-row">
                <span style={{ color: 'var(--text-secondary)' }}>HH Dịch vụ</span>
                <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{staff.execution_commission.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="report-card-row">
                <span style={{ color: 'var(--text-secondary)' }}>Số cuốc</span>
                <span style={{ background: 'rgba(109, 40, 217, 0.1)', color: 'var(--primary)', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontWeight: '700' }}>{staff.total_sessions}</span>
              </div>
              
              <div className="report-card-row bold">
                <span>Tổng Hoa Hồng</span>
                <span style={{ color: 'var(--danger)', fontSize: '1.25rem' }}>{staff.total_commission.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Modal chi tiết hiệu suất nhân viên */}
      {isModalOpen && selectedStaff && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade modal-fullscreen-mobile" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Chi tiết hiệu suất nhân sự</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                  Nhân viên: <strong style={{ color: 'var(--primary)' }}>{selectedStaff.name}</strong> <em style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>({selectedStaff.role})</em> • Từ {new Date(startDate).toLocaleDateString('vi-VN')} đến {new Date(endDate).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <button type="button" onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}><X size={24} /></button>
            </div>

            {/* Tabs & Stats */}
            <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
              <div className="grid grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tổng số cuốc làm</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--primary)' }}>{selectedStaff.total_sessions}</div>
                </div>
                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tổng Giá trị Hiệu suất</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--success)' }}>
                    {(selectedStaff.total_revenue + (selectedStaff.total_sales_revenue || 0)).toLocaleString('vi-VN')}đ
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                    Thực hiện: {selectedStaff.total_revenue.toLocaleString('vi-VN')}đ | Bán hàng: {(selectedStaff.total_sales_revenue || 0).toLocaleString('vi-VN')}đ
                  </div>
                </div>
                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tổng Hoa Hồng Nhận</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--warning)' }}>
                    {selectedStaff.total_commission.toLocaleString('vi-VN')}đ
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                    Thực hiện: {selectedStaff.execution_commission.toLocaleString('vi-VN')}đ | Khác: {(selectedStaff.total_commission - selectedStaff.execution_commission).toLocaleString('vi-VN')}đ
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <button
                  onClick={() => setActiveModalTab('sessions')}
                  className="btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    background: activeModalTab === 'sessions' ? 'rgba(109, 40, 217, 0.08)' : 'transparent',
                    color: activeModalTab === 'sessions' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: activeModalTab === 'sessions' ? '700' : '500',
                    border: 'none'
                  }}
                >
                  Dịch vụ đã làm ({sessionsDetail.length})
                </button>
                <button
                  onClick={() => setActiveModalTab('commissions')}
                  className="btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    background: activeModalTab === 'commissions' ? 'rgba(109, 40, 217, 0.08)' : 'transparent',
                    color: activeModalTab === 'commissions' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: activeModalTab === 'commissions' ? '700' : '500',
                    border: 'none'
                  }}
                >
                  Hoa hồng & Nghiệp vụ khác ({commissionsDetail.filter(c => c.type !== 'service_execution' && c.type !== 'execution').length})
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin text-primary mx-auto" /></div>
              ) : activeModalTab === 'sessions' ? (
                sessionsDetail.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', background: 'var(--bg-main)', borderRadius: '0.5rem' }}>
                    Nhân viên chưa thực hiện phiên dịch vụ nào trong thời gian này.
                  </div>
                ) : (
                  <>
                  <div className="table-responsive hidden-mobile" style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '600px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-main)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.75rem 1rem', width: '20%' }}>Thời gian</th>
                          <th style={{ padding: '0.75rem 1rem', width: '15%' }}>Hóa đơn</th>
                          <th style={{ padding: '0.75rem 1rem', width: '20%' }}>Khách hàng</th>
                          <th style={{ padding: '0.75rem 1rem', width: '20%' }}>Dịch vụ thực hiện</th>
                          <th style={{ padding: '0.75rem 1rem', width: '12.5%', textAlign: 'right' }}>Doanh thu</th>
                          <th style={{ padding: '0.75rem 1rem', width: '12.5%', textAlign: 'right' }}>Hoa hồng KTV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsDetail.map((sess, idx) => (
                          <tr key={sess.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>{formatDateTime(sess.created_at)}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              {sess.invoice_code ? (
                                <a href={`/app/invoices?search=${sess.invoice_code}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                                  #{sess.invoice_code}
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-light)' }}>---</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>
                              {sess.customer_packages?.customer_name || 'Khách vãng lai'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Scissors size={14} style={{ color: 'var(--primary)' }} />
                                <span>{sess.services?.name || 'Dịch vụ không xác định'}</span>
                              </div>
                            </td>
                            <td className="financial-cell" style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>
                              {Number(sess.revenue_amount || 0).toLocaleString()}đ
                            </td>
                            <td className="financial-cell" style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--warning)' }}>
                              {Number(sess.commission_amount || 0).toLocaleString()}đ
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'rgba(109, 40, 217, 0.05)', fontWeight: '800' }}>
                          <td colSpan={4} style={{ padding: '1rem', textAlign: 'right' }}>Tổng cộng:</td>
                          <td className="financial-cell" style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)' }}>
                            {sessionsDetail.reduce((sum, s) => sum + Number(s.revenue_amount || 0), 0).toLocaleString()}đ
                          </td>
                          <td className="financial-cell" style={{ padding: '1rem', textAlign: 'right', color: 'var(--warning)' }}>
                            {sessionsDetail.reduce((sum, s) => sum + Number(s.commission_amount || 0), 0).toLocaleString()}đ
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* MOBILE VIEW (CARDS) */}
                  <div className="visible-mobile">
                    {sessionsDetail.map((sess, idx) => (
                      <div key={sess.id || idx} className="report-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(sess.created_at)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontWeight: '600' }}>
                            <Scissors size={14} />
                            <span>{sess.services?.name || 'Dịch vụ'}</span>
                          </div>
                        </div>
                        <div style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '1rem' }}>
                          {sess.customer_packages?.customer_name || 'Khách vãng lai'}
                        </div>
                        <div className="report-card-row">
                          <span style={{ color: 'var(--text-secondary)' }}>Hóa đơn</span>
                          <span>
                            {sess.invoice_code ? (
                              <a href={`/app/invoices?search=${sess.invoice_code}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                                #{sess.invoice_code}
                              </a>
                            ) : '---'}
                          </span>
                        </div>
                        <div className="report-card-row">
                          <span style={{ color: 'var(--text-secondary)' }}>Doanh thu</span>
                          <span className="financial-cell" style={{ fontWeight: '600', color: 'var(--success)' }}>{Number(sess.revenue_amount || 0).toLocaleString()}đ</span>
                        </div>
                        <div className="report-card-row">
                          <span style={{ color: 'var(--text-secondary)' }}>Hoa hồng KTV</span>
                          <span className="financial-cell" style={{ fontWeight: '700', color: 'var(--warning)' }}>{Number(sess.commission_amount || 0).toLocaleString()}đ</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )
              ) : (
                commissionsDetail.filter(c => c.type !== 'service_execution').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', background: 'var(--bg-main)', borderRadius: '0.5rem' }}>
                    Không có hoa hồng bán hàng hoặc nghiệp vụ khác trong thời gian này.
                  </div>
                ) : (
                  <>
                  <div className="table-responsive hidden-mobile" style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '600px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-main)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.75rem 1rem', width: '20%' }}>Thời gian</th>
                          <th style={{ padding: '0.75rem 1rem', width: '30%' }}>Nghiệp vụ ghi nhận</th>
                          <th style={{ padding: '0.75rem 1rem', width: '20%' }}>Loại</th>
                          <th style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'right' }}>Doanh thu</th>
                          <th style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'right' }}>Hoa hồng nhận</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissionsDetail.filter(c => c.type !== 'service_execution' && c.type !== 'execution').map((comm, idx) => {
                          const rev = comm.package_sales?.amount_paid || 0;
                          return (
                            <tr key={comm.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.75rem 1rem' }}>{formatDateTime(comm.created_at)}</td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{comm.note || 'Thưởng doanh số'}</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <ShoppingBag size={12} /> Bán hàng
                                </span>
                              </td>
                               <td className="financial-cell" style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>
                                 {Number(rev) > 0 ? Number(rev).toLocaleString() + 'đ' : '-'}
                               </td>
                               <td className="financial-cell" style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--warning)' }}>
                                 +{Number(comm.amount || 0).toLocaleString()}đ
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                       <tfoot>
                         <tr style={{ background: 'rgba(109, 40, 217, 0.05)', fontWeight: '800' }}>
                           <td colSpan={3} style={{ padding: '1rem', textAlign: 'right' }}>Tổng cộng:</td>
                           <td className="financial-cell" style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)' }}>
                             {commissionsDetail.filter(c => c.type !== 'service_execution' && c.type !== 'execution')
                               .reduce((sum, c) => sum + Number(c.package_sales?.amount_paid || 0), 0).toLocaleString()}đ
                           </td>
                           <td className="financial-cell" style={{ padding: '1rem', textAlign: 'right', color: 'var(--warning)' }}>
                             {commissionsDetail.filter(c => c.type !== 'service_execution' && c.type !== 'execution').reduce((sum, c) => sum + Number(c.amount || 0), 0).toLocaleString()}đ
                           </td>
                         </tr>
                       </tfoot>
                     </table>
                   </div>
                   
                   {/* MOBILE VIEW (CARDS) */}
                   <div className="visible-mobile">
                     {commissionsDetail.filter(c => c.type !== 'service_execution' && c.type !== 'execution').map((comm, idx) => {
                       const rev = comm.package_sales?.amount_paid || 0;
                       return (
                         <div key={comm.id || idx} className="report-card">
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                             <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(comm.created_at)}</span>
                             <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                               <ShoppingBag size={12} /> Bán hàng
                             </span>
                           </div>
                           <div style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '1rem' }}>
                             {comm.note || 'Thưởng doanh số'}
                           </div>
                           <div className="report-card-row">
                             <span style={{ color: 'var(--text-secondary)' }}>Doanh thu</span>
                             <span className="financial-cell" style={{ fontWeight: '600', color: 'var(--success)' }}>{Number(rev) > 0 ? Number(rev).toLocaleString() + 'đ' : '-'}</span>
                           </div>
                           <div className="report-card-row">
                             <span style={{ color: 'var(--text-secondary)' }}>Hoa hồng nhận</span>
                             <span className="financial-cell" style={{ fontWeight: '700', color: 'var(--warning)' }}>+{Number(comm.amount || 0).toLocaleString()}đ</span>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                   </>
                )
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-main)' }}>
              <button type="button" onClick={handleCloseModal} className="btn btn-secondary" style={{ padding: '0.5rem 1.5rem' }}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ReportsStaff;
