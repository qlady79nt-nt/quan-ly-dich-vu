import React, { useState, useEffect } from 'react';
import { BedDouble, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Mock data representing beds from Supabase
const initialBeds = [
  { id: 1, name: 'Giường 1', status: 'doing', customer: 'Chị Lan', staff: 'NV A', endTime: new Date(Date.now() + 30 * 60000).toISOString(), service: 'Massage body' }, // 30 mins left
  { id: 2, name: 'Giường 2', status: 'available', customer: null, staff: null, endTime: null, service: null },
  { id: 3, name: 'Phòng VIP 1', status: 'doing', customer: 'Anh Tuấn', staff: 'NV B', endTime: new Date(Date.now() + 4 * 60000).toISOString(), service: 'Chăm sóc da' }, // 4 mins left (warning)
  { id: 4, name: 'Giường 4', status: 'doing', customer: 'Chị Mai', staff: 'NV C', endTime: new Date(Date.now() - 1 * 60000).toISOString(), service: 'Gội đầu' }, // done/overdue
];

const BedMonitor = () => {
  const [beds, setBeds] = useState(initialBeds);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Simulate real-time update every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      // In a real app, we would fetch from Supabase here:
      // const { data } = await supabase.from('sessions').select('*, bed:beds(*)').eq('status', 'doing');
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleComplete = (bedId: number) => {
    setBeds(prev => prev.map(bed => {
      if (bed.id === bedId) {
        return { ...bed, status: 'available', customer: null, staff: null, endTime: null, service: null };
      }
      return bed;
    }));
    // In a real app: update Supabase session status = 'done', bed status = 'available'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--primary-color)' }}>Màn Hình Giường Live</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
          <Clock color="var(--secondary-color)" />
          {currentTime.toLocaleTimeString('vi-VN')}
        </div>
      </div>

      <div className="grid-cols-4">
        {beds.map(bed => {
          let timeLeftStr = '';
          let isWarning = false;
          let isOverdue = false;

          if (bed.status === 'doing' && bed.endTime) {
            const diffMs = new Date(bed.endTime).getTime() - currentTime.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins <= 5 && diffMins >= 0) isWarning = true;
            if (diffMins < 0) isOverdue = true;

            timeLeftStr = isOverdue ? 'Đã hết giờ' : `Còn ${diffMins} phút`;
          }

          const isAvailable = bed.status === 'available';
          const cardClass = `premium-card ${isWarning ? 'pulse-warning' : ''}`;
          const borderColor = isAvailable ? 'var(--success-color)' : (isOverdue ? 'var(--danger-color)' : (isWarning ? 'var(--warning-color)' : 'var(--primary-color)'));
          const bgColor = isAvailable ? 'rgba(16, 185, 129, 0.05)' : (isOverdue ? 'rgba(239, 68, 68, 0.05)' : (isWarning ? 'rgba(245, 158, 11, 0.05)' : 'rgba(123, 31, 162, 0.05)'));

          return (
            <div key={bed.id} className={cardClass} style={{ borderTop: `4px solid ${borderColor}`, backgroundColor: bgColor, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BedDouble size={24} color={borderColor} />
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{bed.name}</h3>
                </div>
                {isAvailable ? (
                  <span className="badge badge-success">Trống</span>
                ) : (
                  <span className={`badge ${isWarning || isOverdue ? 'badge-danger' : 'badge-primary'}`}>Đang phục vụ</span>
                )}
              </div>

              {isAvailable ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', minHeight: '120px' }}>
                  Giường đang trống, có thể nhận khách mới
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 500 }}>Khách: <span style={{ color: 'var(--text-primary)' }}>{bed.customer}</span></div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Dịch vụ: {bed.service}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>NV: {bed.staff}</div>
                  
                  <div style={{ 
                    marginTop: 'auto', 
                    padding: '0.5rem', 
                    borderRadius: '0.5rem', 
                    backgroundColor: isOverdue ? 'var(--danger-color)' : (isWarning ? 'var(--warning-color)' : 'var(--primary-light)'),
                    color: 'white',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}>
                    {(isWarning || isOverdue) && <AlertTriangle size={18} />}
                    {timeLeftStr}
                  </div>

                  <button 
                    onClick={() => handleComplete(bed.id)}
                    className="btn-primary" 
                    style={{ marginTop: '0.5rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--success-color)', boxShadow: 'none' }}
                  >
                    <CheckCircle2 size={18} />
                    Hoàn thành
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BedMonitor;
