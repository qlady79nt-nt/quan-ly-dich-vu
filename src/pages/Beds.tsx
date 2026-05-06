import { useState, useEffect } from 'react';
import { LayoutGrid, Plus, Loader2, BedDouble } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Beds = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shopId) fetchBeds();
  }, [shopId]);

  const fetchBeds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('beds')
      .select('*')
      .eq('shop_id', shopId)
      .order('name');
    setBeds(data || []);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#10b981';
      case 'occupied': return '#ef4444';
      case 'cleaning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Giường & Phòng</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Theo dõi trạng thái giường trống và giường đang phục vụ</p>
        </div>
        <button className="btn btn-primary" disabled={isRestricted()}>
          <Plus size={18} /> Thêm Giường
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-4">
          {beds.map((bed) => (
            <div key={bed.id} className="premium-card" style={{ textAlign: 'center', borderTop: `4px solid ${getStatusColor(bed.status)}` }}>
              <div style={{ color: getStatusColor(bed.status), marginBottom: '1rem' }}>
                <BedDouble size={40} style={{ display: 'inline' }} />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{bed.name}</h4>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: getStatusColor(bed.status) }}>
                {bed.status === 'available' ? 'Trống' : (bed.status === 'occupied' ? 'Đang có khách' : 'Đang vệ sinh')}
              </div>
            </div>
          ))}
          {beds.length === 0 && (
            <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
              Chưa có dữ liệu giường. Vui lòng thêm giường để quản lý.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Beds;
