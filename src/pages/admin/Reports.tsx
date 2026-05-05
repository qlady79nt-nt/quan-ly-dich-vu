import { useState, useEffect } from 'react';
import { DollarSign, Users, Target, TrendingUp, Calendar, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const Reports = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSessions: 0,
    completedSessions: 0,
    pendingInvoices: 0,
  });
  const [commissions, setCommissions] = useState<any[]>([]);
  const [bedStats, setBedStats] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  useEffect(() => { if (shopId) fetchReports(); }, [shopId, selectedDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const dayStart = selectedDate + 'T00:00:00';
      const dayEnd = selectedDate + 'T23:59:59';

      // 1. Revenue từ revenue_logs
      const { data: revData } = await supabase
        .from('revenue_logs')
        .select('amount')
        .eq('shop_id', shopId)
        .gte('recorded_at', dayStart)
        .lte('recorded_at', dayEnd);
      const totalRevenue = (revData || []).reduce((sum, r) => sum + Number(r.amount), 0);

      // 2. Sessions trong ngày
      const { data: sessData } = await supabase
        .from('service_sessions')
        .select(`
          id, status, start_time, end_time,
          services(name, price, duration_minutes),
          beds(name),
          profiles!service_sessions_staff_id_fkey(full_name)
        `)
        .eq('shop_id', shopId)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: false });

      const sessions = sessData || [];
      const completed = sessions.filter(s => s.status === 'completed').length;

      setStats({
        totalRevenue,
        totalSessions: sessions.length,
        completedSessions: completed,
        pendingInvoices: sessions.filter(s => s.status === 'waiting' || s.status === 'in_progress').length,
      });
      setRecentSessions(sessions.slice(0, 10));

      // 3. Hoa hồng nhân viên trong ngày
      const { data: comData } = await supabase
        .from('commission_logs')
        .select(`
          amount, type,
          profiles!commission_logs_staff_id_fkey(full_name)
        `)
        .eq('shop_id', shopId)
        .gte('recorded_at', dayStart)
        .lte('recorded_at', dayEnd);

      // Group by staff
      const comByStaff: Record<string, { name: string; service: number; sale: number }> = {};
      (comData || []).forEach((c: any) => {
        const name = c.profiles?.full_name || 'Không rõ';
        if (!comByStaff[name]) comByStaff[name] = { name, service: 0, sale: 0 };
        if (c.type === 'service_execution') comByStaff[name].service += Number(c.amount);
        else if (c.type === 'package_sale') comByStaff[name].sale += Number(c.amount);
      });
      setCommissions(Object.values(comByStaff));

      // 4. Hiệu suất giường (sessions per bed)
      const { data: bedsData } = await supabase
        .from('beds')
        .select('id, name')
        .eq('shop_id', shopId);

      const bedSessionCount: Record<string, number> = {};
      sessions.forEach(s => {
        const bedName = (s.beds as any)?.name || 'Không rõ';
        bedSessionCount[bedName] = (bedSessionCount[bedName] || 0) + 1;
      });

      const totalSessionsForBed = sessions.length || 1;
      setBedStats((bedsData || []).map(b => ({
        name: b.name,
        count: bedSessionCount[b.name] || 0,
        rate: Math.round(((bedSessionCount[b.name] || 0) / totalSessionsForBed) * 100),
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formatCurrency = (n: number) => n.toLocaleString('vi-VN') + 'đ';

  const statusLabel: Record<string, { label: string; className: string }> = {
    waiting: { label: 'Chờ', className: 'badge-warning' },
    in_progress: { label: 'Đang làm', className: 'badge-primary' },
    completed: { label: 'Hoàn thành', className: 'badge-success' },
    cancelled: { label: 'Huỷ', className: 'badge-danger' },
  };

  if (!shopId) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '1rem' }}>
      <h3 style={{ color: 'var(--danger-color)' }}>Chưa liên kết cửa hàng</h3>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* DATE PICKER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--primary-color)' }}>Báo Cáo Doanh Thu</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.25rem' }}>
          <button onClick={() => changeDate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', display: 'flex', borderRadius: '0.25rem' }}><ChevronLeft size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="var(--primary-color)" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}
            />
          </div>
          <button onClick={() => changeDate(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', display: 'flex', borderRadius: '0.25rem' }} disabled={selectedDate >= new Date().toISOString().split('T')[0]}><ChevronRight size={20} /></button>
          <button onClick={fetchReports} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', display: 'flex', color: 'var(--text-light)' }}><RefreshCw size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--primary-color)' }}>
          <Loader2 size={40} className="animate-spin" style={{ display: 'inline' }} />
          <p style={{ marginTop: '1rem' }}>Đang tải báo cáo...</p>
        </div>
      ) : (
        <>
          {/* STAT CARDS */}
          <div className="grid-cols-4">
            {[
              { label: 'Doanh Thu Thực Tế', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'var(--success-color)', bg: 'rgba(16,185,129,0.08)' },
              { label: 'Tổng lượt dịch vụ', value: stats.totalSessions, icon: Target, color: 'var(--primary-color)', bg: 'rgba(109,40,217,0.08)' },
              { label: 'Hoàn thành', value: stats.completedSessions, icon: TrendingUp, color: 'var(--success-color)', bg: 'rgba(16,185,129,0.05)' },
              { label: 'Đang thực hiện', value: stats.pendingInvoices, icon: Users, color: 'var(--warning-color)', bg: 'rgba(245,158,11,0.08)' },
            ].map(s => (
              <div key={s.label} className="premium-card" style={{ background: s.bg, border: `1px solid ${s.color}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{s.label}</p>
                    <p style={{ fontSize: '1.6rem', fontWeight: 700, color: s.color }}>{s.value}</p>
                  </div>
                  <s.icon size={28} color={s.color} style={{ opacity: 0.6 }} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid-cols-2">
            {/* HOA HỒNG NHÂN VIÊN */}
            <div className="premium-card">
              <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                <Users size={22} /> Hoa Hồng Nhân Viên
              </h2>
              {commissions.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '1.5rem' }}>Chưa có dữ liệu hoa hồng hôm nay</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.5rem' }}>Nhân viên</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>HH Dịch vụ</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>HH Bán LT</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--success-color)' }}>{formatCurrency(c.service)}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--secondary-color)' }}>{formatCurrency(c.sale)}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(c.service + c.sale)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(109,40,217,0.04)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>Tổng cộng</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--success-color)' }}>{formatCurrency(commissions.reduce((s, c) => s + c.service, 0))}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--secondary-color)' }}>{formatCurrency(commissions.reduce((s, c) => s + c.sale, 0))}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color)' }}>{formatCurrency(commissions.reduce((s, c) => s + c.service + c.sale, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* HIỆU SUẤT GIƯỜNG */}
            <div className="premium-card">
              <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                <Target size={22} /> Hiệu Suất Không Gian
              </h2>
              {bedStats.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '1.5rem' }}>Chưa có dữ liệu giường</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {bedStats.map(b => (
                    <div key={b.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                        <strong>{b.name}</strong>
                        <span>{b.count} lượt — <strong style={{ color: 'var(--primary-color)' }}>{b.rate}%</strong></span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${b.rate}%`, background: 'linear-gradient(90deg, var(--primary-color), var(--primary-light))', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PHIÊN LÀM VIỆC GẦN ĐÂY */}
          <div className="premium-card">
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
              <TrendingUp size={22} /> Phiên Dịch Vụ Trong Ngày
            </h2>
            {recentSessions.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>Không có phiên dịch vụ nào trong ngày này</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Dịch vụ</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Nhân viên</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Chỗ</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Bắt đầu</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.map(s => {
                      const st = statusLabel[s.status] || { label: s.status, className: 'badge-primary' };
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{(s.services as any)?.name || 'N/A'}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{(s.profiles as any)?.full_name || 'N/A'}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{(s.beds as any)?.name || 'N/A'}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {s.start_time ? new Date(s.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span className={`badge ${st.className}`}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
