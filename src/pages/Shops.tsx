import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Edit2, ShieldAlert, ShieldCheck, Loader2, Calendar, LayoutGrid, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Shops = () => {
  useAuth();
  const [shops, setShops] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    shop_code: '',
    plan_id: '',
    status: 'active',
    expired_at: ''
  });

  useEffect(() => {
    fetchShops();
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase.from('plans').select('*');
    if (data) setPlans(data);
  };

  const fetchShops = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shops')
      .select('*, plans(id, name, price, max_users)')
      .order('created_at', { ascending: false });

    if (!error) setShops(data || []);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const defaultPlanId = plans.find(p => p.name === 'FREE')?.id || plans[0]?.id;
    const payload = {
      ...formData,
      plan_id: formData.plan_id || defaultPlanId,
      expired_at: formData.expired_at || null
    };

    let error;
    if (editingId) {
      const { error: err } = await supabase.from('shops').update(payload).eq('id', editingId);
      error = err;
    } else {
      const { error: err } = await supabase.from('shops').insert([payload]);
      error = err;
    }

    if (!error) {
      fetchShops();
      closeModal();
    } else {
      alert('Lỗi: ' + error.message);
    }
    setSaving(false);
  };

  const openEdit = (shop: any) => {
    setEditingId(shop.id);
    setFormData({
      name: shop.name,
      shop_code: shop.shop_code || '',
      plan_id: shop.plan_id || '',
      status: shop.status,
      expired_at: shop.expired_at ? new Date(shop.expired_at).toISOString().split('T')[0] : ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', shop_code: '', plan_id: plans[0]?.id || '', status: 'active', expired_at: '' });
  };

  const filteredShops = shops.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.shop_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="badge badge-success">Đang hoạt động</span>;
      case 'expired': return <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Hết hạn</span>;
      case 'locked': return <span className="badge badge-danger">Đã khóa</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Hệ thống Cửa hàng</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Theo dõi trạng thái, gói dịch vụ và thời hạn của các Shop</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={18} />
          Tạo Shop mới
        </button>
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Tìm theo tên hoặc mã Shop (SPA-XXX)..." 
            style={{ paddingLeft: '2.75rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2">
          {filteredShops.map((shop) => (
            <div key={shop.id} className="premium-card" style={{ borderLeft: shop.status === 'locked' ? '4px solid var(--danger)' : (shop.status === 'expired' ? '4px solid #f59e0b' : '4px solid var(--success)') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{shop.name}</h4>
                  <div style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: '700' }}>{shop.shop_code}</div>
                </div>
                {getStatusBadge(shop.status)}
              </div>

              <div className="grid grid-cols-2" style={{ gap: '1rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <LayoutGrid size={16} color="var(--text-light)" />
                  <span>Gói: <strong>{shop.plans?.name || 'Chưa có gói'}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <Calendar size={16} color="var(--text-light)" />
                  <span>Hết hạn: <strong>{shop.expired_at ? new Date(shop.expired_at).toLocaleDateString('vi-VN') : 'Không giới hạn'}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => openEdit(shop)} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}>
                  <Edit2 size={14} /> Chỉnh sửa & Gia hạn
                </button>
                {shop.status === 'locked' ? (
                  <button className="btn" style={{ padding: '0.5rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }} title="Mở khóa"><ShieldCheck size={18} /></button>
                ) : (
                  <button className="btn" style={{ padding: '0.5rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)' }} title="Khóa Shop"><ShieldAlert size={18} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Chỉnh sửa */}
      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{editingId ? 'Cấu hình Shop' : 'Tạo Shop mới'}</h3>
              <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label className="form-label">Tên cửa hàng</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div>
                  <label className="form-label">Mã Shop {editingId ? '(Không thể thay đổi)' : '(Để trống để tự sinh)'}</label>
                  <input type="text" className="form-input" placeholder="SPA-XXXXXX" value={formData.shop_code} disabled={!!editingId} onChange={(e) => setFormData({...formData, shop_code: e.target.value.toUpperCase()})} />
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div>
                    <label className="form-label">Gói dịch vụ</label>
                    <select className="form-select" value={formData.plan_id} onChange={(e) => setFormData({...formData, plan_id: e.target.value})}>
                      <option value="">-- Chọn gói --</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Trạng thái</label>
                    <select className="form-select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                      <option value="active">Đang hoạt động</option>
                      <option value="expired">Hết hạn</option>
                      <option value="locked">Bị khóa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Ngày hết hạn</label>
                  <input type="date" className="form-input" value={formData.expired_at} onChange={(e) => setFormData({...formData, expired_at: e.target.value})} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>Hệ thống sẽ tự động chuyển trạng thái sang "Hết hạn" khi tới ngày này.</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={closeModal} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Lưu thay đổi'}
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

export default Shops;
