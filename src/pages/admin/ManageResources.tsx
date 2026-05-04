import { useState, useEffect } from 'react';
import { BedDouble, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const ManageResources = () => {
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    fetchBeds();
  }, []);

  const fetchBeds = async () => {
    try {
      setLoading(true);
      // 1. Get current user's profile to get shop_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('shop_id')
        .eq('id', user.id)
        .single();

      if (profile?.shop_id) {
        setShopId(profile.shop_id);
        
        // 2. Fetch beds for this shop
        const { data: bedsData, error } = await supabase
          .from('beds')
          .select('*')
          .eq('shop_id', profile.shop_id)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        setBeds(bedsData || []);
      }
    } catch (error: any) {
      console.error('Error fetching beds:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBed = async () => {
    if (!shopId) return alert('Chưa tìm thấy thông tin Shop của bạn!');
    
    const bedName = prompt('Nhập tên Không gian (Ví dụ: Chỗ 1, Phòng VIP...):');
    if (!bedName) return;

    try {
      const { error } = await supabase
        .from('beds')
        .insert({
          shop_id: shopId,
          name: bedName,
          status: 'available'
        });

      if (error) throw error;
      fetchBeds();
    } catch (error: any) {
      alert('Lỗi khi thêm: ' + error.message);
    }
  };

  const handleDeleteBed = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa không gian này?')) return;
    
    try {
      const { error } = await supabase
        .from('beds')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchBeds();
    } catch (error: any) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /> Đang tải...</div>;
  }

  return (
    <div className="premium-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BedDouble size={24} />
          Quản lý Không Gian Dịch Vụ
        </h2>
        <button className="btn-primary" onClick={handleAddBed} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} />
          Thêm chỗ mới
        </button>
      </div>

      {beds.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>Chưa có không gian dịch vụ nào. Hãy bấm "Thêm chỗ mới".</p>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {beds.map(bed => (
            <div key={bed.id} style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: '0.5rem', 
              padding: '1.5rem', 
              width: '200px',
              textAlign: 'center',
              position: 'relative'
            }}>
              <button 
                onClick={() => handleDeleteBed(bed.id)}
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}
              >
                <Trash2 size={16} />
              </button>
              <BedDouble size={40} color="var(--primary-light)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{bed.name}</h3>
              {bed.status === 'available' ? (
                <span className="badge badge-success">Đang trống</span>
              ) : (
                <span className="badge badge-danger">Đang có khách</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageResources;
