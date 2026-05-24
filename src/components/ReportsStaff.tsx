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

      // Fetch sessions (cuốc phục vụ)
      const { data: sessions, error: sessErr } = await supabase
        .from('service_sessions')
        .select(`
          id,
          created_at,
          revenue_amount,
          commission_amount,
          status,
          services (name, price),
          customer_packages (customer_name)
        `)
        .eq('staff_id', staff.id)
        .eq('status', 'completed')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false });

      if (sessErr) console.error('Lỗi lấy service_sessions chi tiết:', sessErr);
      setSessionsDetail(sessions || []);

      // Fetch other commission logs (Bán liệu trình hoặc hoa hồng khác)
      const { data: comms, error: commErr } = await supabase
        .from('commission_logs')
        .select('*')
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
          total_revenue: 0,
          total_commission: 0
        };
      });

      // BƯỚC 2: Fetch service_sessions (Tính cuốc & doanh thu)
      const { data: sessions } = await supabase
        .from('service_sessions')
        .select('staff_id, revenue_amount')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      if (sessions) {
        sessions.forEach(sess => {
          if (sess.staff_id && staffMap[sess.staff_id]) {
            staffMap[sess.staff_id].total_sessions += 1;
            staffMap[sess.staff_id].total_revenue += Number(sess.revenue_amount || 0);
          }
        });
      }

      // BƯỚC 3: Fetch commission_logs (Tính hoa hồng)
      const { data: commissions } = await supabase
        .from('commission_logs')
        .select('staff_id, amount')
        .eq('shop_id', shopId)
        .neq('status', 'cancelled')
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      if (commissions) {
        commissions.forEach(comm => {
          if (comm.staff_id && staffMap[comm.staff_id]) {
            staffMap[comm.staff_id].total_commission += Number(comm.amount || 0);
          }
        });
      }

      // BƯỚC 4: Lọc và sắp xếp những người có làm việc
      const activeStaff = Object.values(staffMap)
        .filter(s => s.total_sessions > 0 || s.total_revenue > 0 || s.total_commission > 0)
        .sort((a, b) => b.total_revenue - a.total_revenue);

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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem', width: '40%' }}>Nhân viên</th>
                <th style={{ padding: '1rem', width: '20%', textAlign: 'center' }}>Số cuốc</th>
                <th style={{ padding: '1rem', width: '20%', textAlign: 'right' }}>Doanh thu</th>
                <th style={{ padding: '1rem', width: '20%', textAlign: 'right' }}>Hoa hồng</th>
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
                  <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '700' }}>
                    <span style={{ background: 'rgba(109, 40, 217, 0.1)', color: 'var(--primary)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>
                      {staff.total_sessions}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>
                    {staff.total_revenue > 0 ? `+${staff.total_revenue.toLocaleString()}đ` : '0đ'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: 'var(--warning)' }}>
                    {staff.total_commission > 0 ? `+${staff.total_commission.toLocaleString()}đ` : '0đ'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-main)' }}>
                <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>TỔNG CỘNG</td>
                <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '800', color: 'var(--primary)' }}>
                  {staffStats.reduce((acc, s) => acc + s.total_sessions, 0)}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: 'var(--success)' }}>
                  {staffStats.reduce((acc, s) => acc + s.total_revenue, 0).toLocaleString()}đ
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: 'var(--warning)' }}>
                  {staffStats.reduce((acc, s) => acc + s.total_commission, 0).toLocaleString()}đ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal chi tiết hiệu suất nhân viên */}
      {isModalOpen && selectedStaff && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Doanh thu mang lại</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--success)' }}>{selectedStaff.total_revenue.toLocaleString()}đ</div>
                </div>
                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tổng hoa hồng nhận</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--warning)' }}>{selectedStaff.total_commission.toLocaleString()}đ</div>
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
                  Hoa hồng & Nghiệp vụ khác ({commissionsDetail.filter(c => c.type !== 'service_execution').length})
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
                  <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-main)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Thời gian</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Khách hàng</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Dịch vụ thực hiện</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Doanh thu</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Hoa hồng KTV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsDetail.map((sess, idx) => (
                          <tr key={sess.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>{formatDateTime(sess.created_at)}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>
                              {sess.customer_packages?.customer_name || 'Khách vãng lai'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Scissors size={14} style={{ color: 'var(--primary)' }} />
                                <span>{sess.services?.name || 'Dịch vụ không xác định'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>
                              {Number(sess.revenue_amount || 0).toLocaleString()}đ
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--warning)' }}>
                              {Number(sess.commission_amount || 0).toLocaleString()}đ
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                commissionsDetail.filter(c => c.type !== 'service_execution').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', background: 'var(--bg-main)', borderRadius: '0.5rem' }}>
                    Không có hoa hồng bán hàng hoặc nghiệp vụ khác trong thời gian này.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-main)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Thời gian</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Nghiệp vụ ghi nhận</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Loại</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Hoa hồng nhận</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissionsDetail.filter(c => c.type !== 'service_execution').map((comm, idx) => (
                          <tr key={comm.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>{formatDateTime(comm.created_at)}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{comm.note || 'Thưởng doanh số'}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <ShoppingBag size={12} /> Bán hàng
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                              +{Number(comm.amount || 0).toLocaleString()}đ
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
