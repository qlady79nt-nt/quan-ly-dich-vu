import { useState, useEffect } from 'react';
import { Plus, Search, Scissors, Trash2, Edit2, Loader2, DollarSign, Percent } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Services = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    duration_minutes: 60,
    commission_type: 'percent',
    commission_value: 0,
    status: 'active'
  });

  useEffect(() => {
    if (shopId) fetchServices();
  }, [shopId]);

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (!error) setServices(data || []);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const { error } = await supabase
      .from('services')
      .insert([{ ...formData, shop_id: shopId }]);

    if (!error) {
      fetchServices();
      setIsModalOpen(false);
      setFormData({ name: '', price: 0, duration_minutes: 60, commission_type: 'percent', commission_value: 0, status: 'active' });
    } else {
      alert('Lỗi: ' + error.message);
    }
    setSaving(false);
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
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={18} />
          Tạo dịch vụ
        </button>
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
            <div key={s.id} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(109, 40, 217, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                <Scissors size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{s.name}</h4>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontWeight: '700' }}>
                    {Number(s.price).toLocaleString()}đ
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                    ⏱ {s.duration_minutes} phút
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)', fontWeight: '600' }}>
                    Hoa hồng: {s.commission_type === 'percent' ? `${s.commission_value}%` : `${Number(s.commission_value).toLocaleString()}đ`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)' }}><Edit2 size={16} /></button>
                <button className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--danger)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Thiết lập dịch vụ mới</h3>
            <form onSubmit={handleCreate}>
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
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Lưu dịch vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
