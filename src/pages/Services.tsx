import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Scissors, Trash2, Edit2, Loader2, DollarSign, Percent } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Services = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;

  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    duration_minutes: 60,
    commission_type: 'percent',
    commission_value: 0,
    status: 'active'
  });

  useEffect(() => {
    if (profile) fetchServices();
  }, [profile]);

  const fetchServices = async () => {
    setLoading(true);
    let query = supabase.from('services').select('*').order('created_at', { ascending: false });
    
    // Nếu không phải super_admin thì mới lọc theo shop_id
    if (profile?.role !== 'super_admin') {
      if (!shopId) {
        setLoading(false);
        return;
      }
      query = query.eq('shop_id', shopId);
    }

    const { data, error } = await query;
    if (!error) setServices(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shopId) {
      alert('Lỗi: Không tìm thấy ID cửa hàng. Vui lòng đăng nhập lại.');
      return;
    }

    setSaving(true);
    
    if (editingId) {
      const { error } = await supabase
        .from('services')
        .update(formData)
        .eq('id', editingId);

      if (!error) {
        fetchServices();
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ name: '', price: 0, duration_minutes: 60, commission_type: 'percent', commission_value: 0, status: 'active' });
      } else {
        console.error('Service update error:', error);
        alert('Lỗi khi cập nhật dịch vụ: ' + error.message);
      }
    } else {
      const { error } = await supabase
        .from('services')
        .insert([{ ...formData, shop_id: shopId }]);

      if (!error) {
        fetchServices();
        setIsModalOpen(false);
        setFormData({ name: '', price: 0, duration_minutes: 60, commission_type: 'percent', commission_value: 0, status: 'active' });
      } else {
        console.error('Service creation error:', error);
        alert('Lỗi khi tạo dịch vụ: ' + error.message);
      }
    }
    setSaving(false);
  };

  const handleToggleStatus = async (s: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    const isInactive = s.status === 'inactive';
    const action = isInactive ? 'Bán lại' : 'Ngưng bán';
    if (!window.confirm(`Bạn có chắc chắn muốn ${action.toLowerCase()} dịch vụ này?`)) return;
    
    setLoading(true);
    const { error } = await supabase.from('services').update({ status: isInactive ? 'active' : 'inactive' }).eq('id', s.id);
    if (!error) {
      fetchServices();
    } else {
      alert(`Lỗi khi ${action}: ` + error.message);
      setLoading(false);
    }
  };

  const handleHardDelete = async (id: string) => {
    if (profile?.role !== 'super_admin') return;
    if (!window.confirm('XÓA VĨNH VIỄN dịch vụ này khỏi database? Hành động này DÀNH CHO SUPER ADMIN để xóa data test/bug và KHÔNG THỂ HOÀN TÁC.')) return;
    setLoading(true);
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (!error) {
      fetchServices();
    } else {
      alert('Lỗi khi xóa cứng: ' + error.message);
      setLoading(false);
    }
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setFormData({
      name: s.name,
      price: s.price,
      duration_minutes: s.duration_minutes,
      commission_type: s.commission_type || 'percent',
      commission_value: s.commission_value || 0,
      status: s.status
    });
    setIsModalOpen(true);
  };

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Dịch vụ</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Thiết lập bảng giá và hoa hồng cho kỹ thuật viên</p>
        </div>
        {profile?.role === 'shop_admin' && (
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', price: 0, duration_minutes: 60, commission_type: 'percent', commission_value: 0, status: 'active' });
              setIsModalOpen(true);
            }} 
            className="btn btn-primary"
            disabled={isRestricted()}
            title={isRestricted() ? 'Vui lòng gia hạn gói dịch vụ để sử dụng tính năng này' : ''}
          >
            <Plus size={18} />
            Tạo dịch vụ
          </button>
        )}
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Tìm theo tên dịch vụ..." 
            style={{ paddingLeft: '2.75rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /> Đang tải...</div>
      ) : (
        <div className="grid grid-cols-2">
          {filteredServices.map((s) => (
            <div key={s.id} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', opacity: s.status === 'inactive' ? 0.6 : 1, transition: 'opacity 0.2s' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: s.status === 'inactive' ? 'rgba(0,0,0,0.05)' : 'rgba(109, 40, 217, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.status === 'inactive' ? 'var(--text-light)' : 'var(--primary)', flexShrink: 0 }}>
                <Scissors size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '1.1rem', textDecoration: s.status === 'inactive' ? 'line-through' : 'none', margin: 0 }}>{s.name}</h4>
                  {s.status === 'inactive' && <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-light)', border: '1px solid var(--border)' }}>NGƯNG BÁN</span>}
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: s.status === 'inactive' ? 'var(--text-secondary)' : 'var(--primary)', fontWeight: '700' }}>
                    {Number(s.price).toLocaleString()}đ
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                    ⏱ {s.duration_minutes} phút
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: s.status === 'inactive' ? 'var(--text-secondary)' : 'var(--success)', fontWeight: '600' }}>
                    Hoa hồng: {s.commission_type === 'percent' ? `${s.commission_value}%` : `${Number(s.commission_value).toLocaleString()}đ`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {profile?.role === 'shop_admin' && (
                  <button onClick={() => handleEdit(s)} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)' }}><Edit2 size={16} /></button>
                )}
                {profile?.role === 'shop_admin' && (
                  <button onClick={() => handleToggleStatus(s)} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: s.status === 'inactive' ? 'var(--success)' : 'var(--text-light)', border: '1px solid var(--border)' }}>
                    {s.status === 'inactive' ? 'Bán lại' : 'Ngưng bán'}
                  </button>
                )}
                {profile?.role === 'super_admin' && (
                  <button onClick={() => handleHardDelete(s.id)} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--danger)' }} title="Xóa cứng (Super Admin)"><Trash2 size={16} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Cập nhật dịch vụ' : 'Thiết lập dịch vụ mới'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Tên dịch vụ</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá dịch vụ (đ)</label>
                  <input type="number" className="form-input" required value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Thời gian (phút)</label>
                  <input type="number" className="form-input" required value={formData.duration_minutes} onChange={(e) => setFormData({...formData, duration_minutes: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Loại hoa hồng</label>
                  <select className="form-select" value={formData.commission_type} onChange={(e) => setFormData({...formData, commission_type: e.target.value})}>
                    <option value="percent">Theo % (Phần trăm)</option>
                    <option value="fixed">Theo tiền (Cố định)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá trị hoa hồng</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" className="form-input" required value={formData.commission_value} onChange={(e) => setFormData({...formData, commission_value: Number(e.target.value)})} />
                    <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}>
                      {formData.commission_type === 'percent' ? <Percent size={14} /> : <DollarSign size={14} />}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                    {formData.commission_type === 'percent' ? 'Nhập số từ 1-100 (VD: 10 = 10% giá lẻ)' : 'Nhập số tiền mặt (VD: 50000 = 50.000đ)'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : (editingId ? 'Cập nhật' : 'Lưu dịch vụ')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Services;
