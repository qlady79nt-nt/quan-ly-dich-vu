import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Package as PackageIcon, Trash2, Edit2, Loader2, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Packages = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;

  const [packages, setPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    service_id: '',
    total_sessions: 10,
    original_price: 0,
    discount_type: 'none',
    discount_value: 0,
    sale_price: 0,
    commission_sale_type: 'percent',
    commission_sale_value: 5
  });

  useEffect(() => {
    if (profile) {
      fetchPackages();
      fetchServices();
    }
  }, [profile]);

  const fetchPackages = async () => {
    setLoading(true);
    let query = supabase.from('packages').select('*, services(name)').order('created_at', { ascending: false });

    if (profile?.role !== 'super_admin') {
      if (!shopId) {
        setLoading(false);
        return;
      }
      query = query.eq('shop_id', shopId);
    }

    const { data, error } = await query;
    if (!error) setPackages(data || []);
    setLoading(false);
  };

  const fetchServices = async () => {
    let query = supabase.from('services').select('id, name, price');
    
    if (profile?.role !== 'super_admin') {
      if (!shopId) return;
      query = query.eq('shop_id', shopId);
    }

    const { data } = await query;
    if (data) setServices(data);
  };

  // Logic tự động tính giá bán khi thay đổi giá gốc hoặc giảm giá
  useEffect(() => {
    let final = formData.original_price;
    if (formData.discount_type === 'percent') {
      final = final * (1 - formData.discount_value / 100);
    } else if (formData.discount_type === 'fixed') {
      final = final - formData.discount_value;
    }
    setFormData(prev => ({ ...prev, sale_price: final }));
  }, [formData.original_price, formData.discount_type, formData.discount_value]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.service_id) return alert('Vui lòng chọn dịch vụ gắn kèm');
    
    if (!shopId) {
      alert('Lỗi: Không tìm thấy ID cửa hàng. Vui lòng đăng nhập lại.');
      return;
    }

    setSaving(true);
    
    const { error } = await supabase
      .from('packages')
      .insert([{ ...formData, shop_id: shopId }]);

    if (!error) {
      fetchPackages();
      setIsModalOpen(false);
      setFormData({ name: '', service_id: '', total_sessions: 10, original_price: 0, discount_type: 'none', discount_value: 0, sale_price: 0, commission_sale_type: 'percent', commission_sale_value: 5 });
    } else {
      console.error('Package creation error:', error);
      alert('Lỗi khi tạo liệu trình: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    if (!window.confirm('Bạn có chắc chắn muốn xoá liệu trình này?')) return;
    
    setLoading(true);
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (!error) {
      fetchPackages();
    } else {
      alert('Lỗi khi xoá: ' + error.message);
      setLoading(false);
    }
  };

  const handleEdit = () => {
    alert('Tính năng chỉnh sửa đang được phát triển. Vui lòng xoá và tạo lại liệu trình mới.');
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Liệu trình (Gói)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tạo các gói liệu trình nhiều buổi gắn liền với dịch vụ</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="btn btn-primary"
          disabled={isRestricted()}
          title={isRestricted() ? 'Vui lòng gia hạn gói dịch vụ để sử dụng tính năng này' : ''}
        >
          <Plus size={18} />
          Tạo liệu trình
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /> Đang tải...</div>
      ) : (
        <div className="grid grid-cols-2">
          {packages.map((p) => (
            <div key={p.id} className="premium-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary)' }}>
                    <PackageIcon size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.1rem' }}>{p.name}</h4>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Link2 size={14} /> Gắn với: {p.services?.name}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>{Number(p.sale_price).toLocaleString()}đ</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>{Number(p.original_price).toLocaleString()}đ</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                  <div>Số buổi: <strong>{p.total_sessions}</strong></div>
                  <div>HH Bán: <strong>{p.commission_sale_type === 'percent' ? `${p.commission_sale_value}%` : `${p.commission_sale_value}đ`}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleEdit} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--text-secondary)' }}><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(p.id)} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--danger)' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Thiết lập liệu trình mới</h3>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Tên liệu trình</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Dịch vụ gắn kèm *</label>
                  <select className="form-select" required value={formData.service_id} onChange={(e) => setFormData({...formData, service_id: e.target.value})}>
                    <option value="">-- Chọn dịch vụ --</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} ({Number(s.price).toLocaleString()}đ)</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Tổng số buổi</label>
                  <input type="number" className="form-input" required value={formData.total_sessions} onChange={(e) => setFormData({...formData, total_sessions: Number(e.target.value)})} />
                </div>

                <div style={{ borderTop: '1px solid var(--border)', gridColumn: 'span 2', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>Cấu hình giá & giảm giá</h4>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá gốc (đ)</label>
                  <input type="number" className="form-input" required value={formData.original_price} onChange={(e) => setFormData({...formData, original_price: Number(e.target.value)})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Loại giảm</label>
                    <select className="form-select" value={formData.discount_type} onChange={(e) => setFormData({...formData, discount_type: e.target.value})}>
                      <option value="none">Không</option>
                      <option value="percent">%</option>
                      <option value="fixed">Tiền mặt</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá trị</label>
                    <input type="number" className="form-input" disabled={formData.discount_type === 'none'} value={formData.discount_value} onChange={(e) => setFormData({...formData, discount_value: Number(e.target.value)})} />
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2', background: 'rgba(109, 40, 217, 0.05)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(109, 40, 217, 0.1)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Giá bán cuối cùng: </span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{formData.sale_price.toLocaleString()}đ</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', gridColumn: 'span 2', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>Hoa hồng khi nhân viên BÁN gói này</h4>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Loại hoa hồng bán</label>
                  <select className="form-select" value={formData.commission_sale_type} onChange={(e) => setFormData({...formData, commission_sale_type: e.target.value})}>
                    <option value="percent">% (Trên giá bán)</option>
                    <option value="fixed">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá trị HH bán</label>
                  <input type="number" className="form-input" value={formData.commission_sale_value} onChange={(e) => setFormData({...formData, commission_sale_value: Number(e.target.value)})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Lưu liệu trình'}
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

export default Packages;
