import { useState, useEffect, useRef } from 'react';
import { BedDouble, Clock, AlertTriangle, CheckCircle2, Loader2, RefreshCw, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface Bed {
  id: string;
  name: string;
  status: string;
  activeSession?: {
    id: string;
    customer_name: string | null;
    service_name: string;
    staff_name: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
  } | null;
}

const BedMonitor = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (shopId) fetchBeds();
  }, [shopId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!shopId) return;
    intervalRef.current = setInterval(fetchBeds, 30000);
    return () => clearInterval(intervalRef.current);
  }, [shopId]);

  const fetchBeds = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      // 1. Lấy danh sách giường
      const { data: bedsData } = await supabase
        .from('beds')
        .select('*')
        .eq('shop_id', shopId)
        .order('name');

      // 2. Lấy các session đang active
      const { data: activeSessions } = await supabase
        .from('service_sessions')
        .select(`
          id, start_time, end_time, bed_id,
          invoices(customer_name),
          services(name, duration_minutes),
          profiles!service_sessions_staff_id_fkey(full_name)
        `)
        .eq('shop_id', shopId)
        .in('status', ['waiting', 'in_progress'])
        .not('bed_id', 'is', null);

      // Merge dữ liệu
      const enriched: Bed[] = (bedsData || []).map(bed => {
        const session = (activeSessions || []).find(s => s.bed_id === bed.id);
        if (session) {
          return {
            ...bed,
            status: 'occupied',
            activeSession: {
              id: session.id,
              customer_name: (session.invoices as any)?.customer_name || 'Khách lẻ',
              service_name: (session.services as any)?.name || 'Dịch vụ',
              staff_name: (session.profiles as any)?.full_name || 'Không rõ',
              start_time: session.start_time,
              end_time: session.end_time,
              duration_minutes: (session.services as any)?.duration_minutes || 60,
            }
          };
        }
        return { ...bed, activeSession: null };
      });
      setBeds(enriched);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleComplete = async (session: NonNullable<Bed['activeSession']>, bedId: string) => {
    if (!confirm('Đánh dấu hoàn thành dịch vụ này?')) return;
    try {
      // Update session status
      const { error } = await supabase
        .from('service_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          revenue_recorded: true
        })
        .eq('id', session.id);

      if (error) throw error;

      // Update bed status back to available
      await supabase.from('beds').update({ status: 'available' }).eq('id', bedId);

      // Ghi revenue log nếu chưa có
      await supabase.from('revenue_logs').insert({
        shop_id: shopId,
        session_id: session.id,
        amount: 0, // Sẽ tính từ service price — bạn có thể improve sau
        note: 'Hoàn thành dịch vụ từ BedMonitor'
      });

      fetchBeds();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
  };

  if (!shopId) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '1rem' }}>
      <h3 style={{ color: 'var(--danger-color)' }}>Chưa liên kết cửa hàng</h3>
    </div>
  );

  const availableCount = beds.filter(b => b.status === 'available' || !b.activeSession).length;
  const occupiedCount = beds.length - availableCount;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: 'var(--primary-color)', marginBottom: '0.25rem' }}>Màn Hình Trạng Thái Live</h2>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--success-color)' }}>✅ Trống: {availableCount}</span>
            <span style={{ color: 'var(--primary-color)' }}>🔵 Đang phục vụ: {occupiedCount}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={fetchBeds} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--secondary-color)' }}>
            <Clock size={24} />
            {currentTime.toLocaleTimeString('vi-VN')}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--primary-color)' }}>
          <Loader2 size={40} className="animate-spin" style={{ display: 'inline' }} />
          <p style={{ marginTop: '1rem' }}>Đang tải trạng thái giường...</p>
        </div>
      ) : beds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '1rem' }}>
          <BedDouble size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <h3 style={{ color: 'var(--text-light)', marginBottom: '0.5rem' }}>Chưa có không gian dịch vụ</h3>
          <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Vui lòng thêm giường/chỗ tại Admin Panel → Không gian dịch vụ</p>
        </div>
      ) : (
        <div className="grid-cols-4">
          {beds.map(bed => {
            const session = bed.activeSession;
            const isOccupied = !!session;

            let timeLeftStr = '';
            let isWarning = false;
            let isOverdue = false;

            if (isOccupied && session?.end_time) {
              const diffMs = new Date(session.end_time).getTime() - currentTime.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              if (diffMins <= 5 && diffMins >= 0) isWarning = true;
              if (diffMins < 0) { isOverdue = true; }
              timeLeftStr = isOverdue
                ? `Quá ${Math.abs(diffMins)} phút`
                : `Còn ${diffMins} phút`;
            } else if (isOccupied && session?.start_time && session?.duration_minutes) {
              // Tính từ start_time + duration
              const endTime = new Date(new Date(session.start_time).getTime() + session.duration_minutes * 60000);
              const diffMs = endTime.getTime() - currentTime.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              if (diffMins <= 5 && diffMins >= 0) isWarning = true;
              if (diffMins < 0) isOverdue = true;
              timeLeftStr = isOverdue ? `Quá ${Math.abs(diffMins)} phút` : `Còn ${diffMins} phút`;
            }

            const borderColor = !isOccupied
              ? 'var(--success-color)'
              : isOverdue ? 'var(--danger-color)'
              : isWarning ? 'var(--warning-color)'
              : 'var(--primary-color)';

            const bgColor = !isOccupied
              ? 'rgba(16, 185, 129, 0.05)'
              : isOverdue ? 'rgba(239, 68, 68, 0.05)'
              : isWarning ? 'rgba(245, 158, 11, 0.05)'
              : 'rgba(123, 31, 162, 0.03)';

            return (
              <div key={bed.id} className={`premium-card ${isWarning ? 'pulse-warning' : ''}`}
                style={{ borderTop: `4px solid ${borderColor}`, backgroundColor: bgColor, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BedDouble size={24} color={borderColor} />
                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{bed.name}</h3>
                  </div>
                  {!isOccupied
                    ? <span className="badge badge-success">Trống</span>
                    : <span className={`badge ${isWarning || isOverdue ? 'badge-danger' : 'badge-primary'}`}>Đang làm</span>
                  }
                </div>

                {!isOccupied ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', minHeight: '100px', flexDirection: 'column', gap: '0.5rem' }}>
                    <PlayCircle size={32} style={{ opacity: 0.3 }} />
                    <span style={{ fontSize: '0.875rem' }}>Sẵn sàng nhận khách</span>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 500 }}>
                      👤 <span style={{ color: 'var(--text-primary)' }}>{session?.customer_name || 'Khách lẻ'}</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      💆 {session?.service_name}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      👩‍⚕️ {session?.staff_name}
                    </div>

                    <div style={{
                      marginTop: 'auto', padding: '0.5rem', borderRadius: '0.5rem',
                      backgroundColor: isOverdue ? 'var(--danger-color)' : isWarning ? 'var(--warning-color)' : 'var(--primary-light)',
                      color: 'white', fontWeight: 'bold', textAlign: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}>
                      {(isWarning || isOverdue) && <AlertTriangle size={18} />}
                      {timeLeftStr || 'Đang tiến hành'}
                    </div>

                    {session && (
                      <button
                        onClick={() => handleComplete(session, bed.id)}
                        className="btn-primary"
                        style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--success-color)', boxShadow: 'none', fontSize: '0.875rem' }}
                      >
                        <CheckCircle2 size={18} /> Hoàn thành
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BedMonitor;
