import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Briefcase, Calendar } from 'lucide-react';

interface ReportsStaffProps {
  shopId: string;
}

const ReportsStaff = ({ shopId }: ReportsStaffProps) => {
  const [loading, setLoading] = useState(true);
  const [staffStats, setStaffStats] = useState<any[]>([]);
  
  const today = new Date();
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(today.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    handleFilterChange(filterType);
  }, [filterType]);

  useEffect(() => {
    if (shopId) {
      fetchStaffStats();
    }
  }, [shopId, startDate, endDate]);

  const handleFilterChange = (type: 'today' | 'week' | 'month' | 'custom') => {
    const now = new Date();
    
    if (type === 'today') {
      const formatted = now.toISOString().split('T')[0];
      setStartDate(formatted);
      setEndDate(formatted);
    } else if (type === 'week') {
      const first = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
      const firstDay = new Date(now.setDate(first));
      const lastDay = new Date(now.setDate(first + 6));
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    } else if (type === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    }
  };

  const fetchStaffStats = async () => {
    setLoading(true);
    try {
      const startObj = new Date(startDate + 'T00:00:00');
      const endObj = new Date(endDate + 'T23:59:59.999');
      const startStr = startObj.toISOString();
      const endStr = endObj.toISOString();

      // BƯỚC 1: Fetch staffs
      const { data: staffs } = await supabase
        .from('staffs')
        .select('id, full_name')
        .eq('shop_id', shopId);
        
      const staffList = staffs || [];
      const staffMap: Record<string, any> = {};
      
      staffList.forEach(s => {
        staffMap[s.id] = {
          id: s.id,
          name: s.full_name,
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
        
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '0.75rem' }}>
          <button 
            onClick={() => setFilterType('today')}
            className="btn" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: filterType === 'today' ? 'white' : 'transparent', color: filterType === 'today' ? 'var(--primary)' : 'var(--text-secondary)', boxShadow: filterType === 'today' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            Hôm nay
          </button>
          <button 
            onClick={() => setFilterType('week')}
            className="btn" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: filterType === 'week' ? 'white' : 'transparent', color: filterType === 'week' ? 'var(--primary)' : 'var(--text-secondary)', boxShadow: filterType === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            Tuần này
          </button>
          <button 
            onClick={() => setFilterType('month')}
            className="btn" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: filterType === 'month' ? 'white' : 'transparent', color: filterType === 'month' ? 'var(--primary)' : 'var(--text-secondary)', boxShadow: filterType === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            Tháng này
          </button>
          <button 
            onClick={() => setFilterType('custom')}
            className="btn" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: filterType === 'custom' ? 'white' : 'transparent', color: filterType === 'custom' ? 'var(--primary)' : 'var(--text-secondary)', boxShadow: filterType === 'custom' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            Tùy chọn
          </button>
        </div>
      </div>

      {filterType === 'custom' && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Từ ngày:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" style={{ width: '150px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Đến ngày:</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" style={{ width: '150px' }} />
          </div>
          <button onClick={fetchStaffStats} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} /> Lọc
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin text-primary mx-auto" size={32} />
        </div>
      ) : staffStats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-main)', borderRadius: '1rem', color: 'var(--text-light)' }}>
          Không có dữ liệu nhân viên trong khoảng thời gian này
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
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'default' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-main)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
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
    </div>
  );
};

export default ReportsStaff;
