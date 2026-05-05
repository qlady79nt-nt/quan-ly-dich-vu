import { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Loader2, Edit2, Check, X, Syringe, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  commission_rate: number;
  status: string;
}

interface PackageItem {
  id: string;
  name: string;
  total_sessions: number;
  price: number;
  commission_sale_rate: number;
  status: string;
}

const ManageServices = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [editPkg, setEditPkg] = useState<PackageItem | null>(null);

  const [svcForm, setSvcForm] = useState({ name: '', price: 0, duration_minutes: 60, commission_rate: 10 });
  const [pkgForm, setPkgForm] = useState({ name: '', total_sessions: 10, price: 0, commission_sale_rate: 5 });

  useEffect(() => { if (shopId) fetchAll(); }, [shopId]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: svc }, { data: pkg }] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId).order('created_at'),
      supabase.from('packages').select('*').eq('shop_id', shopId).order('created_at'),
    ]);
    setServices(svc || []);
    setPackages(pkg || []);
    setLoading(false);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('services').insert({ ...svcForm, shop_id: shopId, status: 'active' });
      if (error) throw error;
      setSvcForm({ name: '', price: 0, duration_minutes: 60, commission_rate: 10 });
      fetchAll();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleUpdateService = async () => {
    if (!editSvc) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('services').update({
        name: editSvc.name, price: editSvc.price,
        duration_minutes: editSvc.duration_minutes, commission_rate: editSvc.commission_rate
      }).eq('id', editSvc.id);
      if (error) throw error;
      setEditSvc(null);
      fetchAll();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Xoá dịch vụ này?')) return;
    await supabase.from('services').update({ status: 'inactive' }).eq('id', id);
    fetchAll();
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('packages').insert({ ...pkgForm, shop_id: shopId, status: 'active' });
      if (error) throw error;
      setPkgForm({ name: '', total_sessions: 10, price: 0, commission_sale_rate: 5 });
      fetchAll();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleUpdatePackage = async () => {
    if (!editPkg) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('packages').update({
        name: editPkg.name, price: editPkg.price,
        total_sessions: editPkg.total_sessions, commission_sale_rate: editPkg.commission_sale_rate
      }).eq('id', editPkg.id);
      if (error) throw error;
      setEditPkg(null);
      fetchAll();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Xoá liệu trình này?')) return;
    await supabase.from('packages').update({ status: 'inactive' }).eq('id', id);
    fetchAll();
  };

  if (!shopId) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '1rem' }}>
      <h3 style={{ color: 'var(--danger-color)' }}>Chưa liên kết cửa hàng</h3>
      <p>Vui lòng vào mục Cửa hàng để cấu hình trước.</p>
    </div>
  );

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--primary-color)' }}>
      <Loader2 size={32} className="animate-spin" style={{ display: 'inline' }} />
    </div>
  );

  const activeServices = services.filter(s => s.status !== 'inactive');
  const activePackages = packages.filter(p => p.status !== 'inactive');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 1200, margin: '0 auto' }}>

      {/* DỊCH VỤ LẺ */}
      <div className="grid-cols-2" style={{ gridTemplateColumns: '380px 1fr' }}>
        {/* Form tạo dịch vụ */}
        <div className="premium-card" style={{ alignSelf: 'start' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            <Package size={22} /> Tạo Dịch Vụ Mới
          </h2>
          <form onSubmit={handleCreateService}>
            <div className="form-group">
              <label className="form-label">Tên dịch vụ *</label>
              <input type="text" className="form-input" placeholder="Massage body 60 phút" value={svcForm.name} onChange={e => setSvcForm({ ...svcForm, name: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Giá (VNĐ) *</label>
                <input type="number" className="form-input" placeholder="500000" min={0} step={10000} value={svcForm.price} onChange={e => setSvcForm({ ...svcForm, price: Number(e.target.value) })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Thời gian (phút) *</label>
                <input type="number" className="form-input" placeholder="60" min={5} value={svcForm.duration_minutes} onChange={e => setSvcForm({ ...svcForm, duration_minutes: Number(e.target.value) })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Hoa hồng KTV (%)</label>
              <input type="number" className="form-input" placeholder="10" min={0} max={100} value={svcForm.commission_rate} onChange={e => setSvcForm({ ...svcForm, commission_rate: Number(e.target.value) })} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              Lưu Dịch vụ
            </button>
          </form>
        </div>

        {/* Danh sách dịch vụ */}
        <div className="premium-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Package size={22} /> Danh sách Dịch Vụ ({activeServices.length})
            </h2>
            <button onClick={fetchAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}><RefreshCw size={18} /></button>
          </div>

          {activeServices.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>Chưa có dịch vụ nào.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeServices.map(svc => (
                <div key={svc.id}>
                  {editSvc?.id === svc.id ? (
                    <div style={{ background: 'rgba(109,40,217,0.05)', border: '1px solid var(--primary-color)', borderRadius: '0.5rem', padding: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input className="form-input" style={{ padding: '0.4rem' }} value={editSvc.name} onChange={e => setEditSvc({ ...editSvc, name: e.target.value })} />
                        <input type="number" className="form-input" style={{ padding: '0.4rem' }} value={editSvc.price} onChange={e => setEditSvc({ ...editSvc, price: Number(e.target.value) })} />
                        <input type="number" className="form-input" style={{ padding: '0.4rem' }} value={editSvc.duration_minutes} onChange={e => setEditSvc({ ...editSvc, duration_minutes: Number(e.target.value) })} />
                        <input type="number" className="form-input" style={{ padding: '0.4rem' }} value={editSvc.commission_rate} onChange={e => setEditSvc({ ...editSvc, commission_rate: Number(e.target.value) })} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditSvc(null)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '0.25rem', padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}><X size={14} /> Huỷ</button>
                        <button onClick={handleUpdateService} disabled={saving} className="btn-primary" style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}><Check size={14} /> Lưu</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{svc.name}</strong>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{svc.price.toLocaleString('vi-VN')}đ</span>
                          <span>⏱ {svc.duration_minutes} phút</span>
                          <span>💰 HH: {svc.commission_rate}%</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button onClick={() => setEditSvc(svc)} style={{ background: 'rgba(109,40,217,0.1)', border: 'none', borderRadius: '0.4rem', padding: '0.4rem', cursor: 'pointer', color: 'var(--primary-color)', display: 'flex' }}><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteService(svc.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '0.4rem', padding: '0.4rem', cursor: 'pointer', color: 'var(--danger-color)', display: 'flex' }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LIỆU TRÌNH */}
      <div className="grid-cols-2" style={{ gridTemplateColumns: '380px 1fr' }}>
        {/* Form tạo liệu trình */}
        <div className="premium-card" style={{ alignSelf: 'start' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            <Syringe size={22} /> Tạo Liệu Trình
          </h2>
          <form onSubmit={handleCreatePackage}>
            <div className="form-group">
              <label className="form-label">Tên liệu trình *</label>
              <input type="text" className="form-input" placeholder="Trị mụn chuyên sâu (10 buổi)" value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Số buổi *</label>
                <input type="number" className="form-input" min={1} value={pkgForm.total_sessions} onChange={e => setPkgForm({ ...pkgForm, total_sessions: Number(e.target.value) })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Giá cả gói (VNĐ) *</label>
                <input type="number" className="form-input" min={0} step={10000} value={pkgForm.price} onChange={e => setPkgForm({ ...pkgForm, price: Number(e.target.value) })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Hoa hồng bán (%)</label>
              <input type="number" className="form-input" placeholder="5" min={0} max={100} value={pkgForm.commission_sale_rate} onChange={e => setPkgForm({ ...pkgForm, commission_sale_rate: Number(e.target.value) })} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--secondary-color)' }}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              Lưu Liệu Trình
            </button>
          </form>
        </div>

        {/* Danh sách liệu trình */}
        <div className="premium-card">
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            <Syringe size={22} /> Danh sách Liệu Trình ({activePackages.length})
          </h2>

          {activePackages.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>Chưa có liệu trình nào.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activePackages.map(pkg => (
                <div key={pkg.id}>
                  {editPkg?.id === pkg.id ? (
                    <div style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid var(--secondary-color)', borderRadius: '0.5rem', padding: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input className="form-input" style={{ padding: '0.4rem' }} value={editPkg.name} onChange={e => setEditPkg({ ...editPkg, name: e.target.value })} />
                        <input type="number" className="form-input" style={{ padding: '0.4rem' }} value={editPkg.total_sessions} onChange={e => setEditPkg({ ...editPkg, total_sessions: Number(e.target.value) })} />
                        <input type="number" className="form-input" style={{ padding: '0.4rem' }} value={editPkg.price} onChange={e => setEditPkg({ ...editPkg, price: Number(e.target.value) })} />
                        <input type="number" className="form-input" style={{ padding: '0.4rem' }} value={editPkg.commission_sale_rate} onChange={e => setEditPkg({ ...editPkg, commission_sale_rate: Number(e.target.value) })} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditPkg(null)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '0.25rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><X size={14} /> Huỷ</button>
                        <button onClick={handleUpdatePackage} disabled={saving} className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Check size={14} /> Lưu</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid rgba(212,175,55,0.4)', borderRadius: '0.5rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(212,175,55,0.03)' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{pkg.name}</strong>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--secondary-color)', fontWeight: 600 }}>{pkg.price.toLocaleString('vi-VN')}đ</span>
                          <span>📅 {pkg.total_sessions} buổi</span>
                          <span>💰 HH bán: {pkg.commission_sale_rate}%</span>
                          <span style={{ color: 'var(--success-color)' }}>{pkg.total_sessions > 0 ? (pkg.price / pkg.total_sessions).toLocaleString('vi-VN') + 'đ/buổi' : ''}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button onClick={() => setEditPkg(pkg)} style={{ background: 'rgba(212,175,55,0.15)', border: 'none', borderRadius: '0.4rem', padding: '0.4rem', cursor: 'pointer', color: 'var(--secondary-color)', display: 'flex' }}><Edit2 size={16} /></button>
                        <button onClick={() => handleDeletePackage(pkg.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '0.4rem', padding: '0.4rem', cursor: 'pointer', color: 'var(--danger-color)', display: 'flex' }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageServices;
