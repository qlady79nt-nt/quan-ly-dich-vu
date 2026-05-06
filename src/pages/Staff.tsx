import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, Trash2, Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const AVAILABLE_PERMISSIONS = [
  { id: 'sale.create', label: 'Tạo hoá đơn', group: 'Bán hàng' },
  { id: 'sale.discount', label: 'Giảm giá', group: 'Bán hàng' },
  { id: 'sale.edit', label: 'Sửa hoá đơn', group: 'Bán hàng' },
  { id: 'sale.delete', label: 'Xoá hoá đơn', group: 'Bán hàng' },
  { id: 'report.revenue.view', label: 'Xem doanh thu', group: 'Báo cáo' },
  { id: 'report.invoice.view', label: 'Xem danh sách hoá đơn', group: 'Báo cáo' },
  { id: 'report.commission.view', label: 'Xem hoa hồng', group: 'Báo cáo' },
  { id: 'invoice.print', label: 'In hoá đơn', group: 'Vận hành' },
];

const Staff = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<any>({
    full_name: '',
    username: '',
    role: 'staff',
    staff_type: 'both',
    permissions: [],
    status: 'active'
  });

  useEffect(() => {
    if (profile) fetchStaff();
  }, [profile]);

  const fetchStaff = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });

    if (profile?.role !== 'super_admin') {
      if (!shopId) {
        setLoading(false);
        return;
      }
      query = query.eq('shop_id', shopId);
    }

    const { data, error } = await query;
    if (!error) setStaff(data || []);
    setLoading(false);
  };

  const handleTogglePermission = (permId: string) => {
    setFormData((prev: any) => {
      const current = prev.permissions || [];
      const next = current.includes(permId)
        ? current.filter((p: string) => p !== permId)
        : [...current, permId];
      return { ...prev, permissions: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shopId) {
      alert('Lỗi: Không tìm thấy ID cửa hàng. Vui lòng đăng nhập lại.');
      return;
    }

    setSaving(true);
    
    const payload = { ...formData, shop_id: shopId };
    
    let error;
    if (editingId) {
      const { error: err } = await supabase.from('profiles').update(payload).eq('id', editingId);
      error = err;
    } else {
      const { error: err } = await supabase.from('profiles').insert([payload]);
      error = err;
    }

    if (!error) {
      fetchStaff();
      closeModal();
    } else {
      console.error('Staff save error:', error);
      alert('Lỗi khi lưu nhân viên: ' + error.message);
    }
    setSaving(false);
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setFormData({
      full_name: s.full_name,
      username: s.username || '',
      role: s.role,
      staff_type: s.staff_type,
      permissions: s.permissions || [],
      status: s.status
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ full_name: '', username: '', role: 'staff', staff_type: 'both', permissions: [], status: 'active' });
  };

  const filteredStaff = staff.filter(s => 
    (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Nhân sự & Phân quyền</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Cấp quyền chi tiết cho từng vai trò trong cửa hàng</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="btn btn-primary"
          disabled={isRestricted()}
          title={isRestricted() ? 'Vui lòng gia hạn gói dịch vụ để sử dụng tính năng này' : ''}
        >
          <UserPlus size={18} />
          Thêm thành viên
        </button>
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Tìm theo tên hoặc username..." 
            style={{ paddingLeft: '2.75rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-3">
          {filteredStaff.map((s) => (
            <div key={s.id} className="premium-card" style={{ borderTop: s.role === 'shop_admin' ? '4px solid var(--secondary)' : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                  {(s.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ marginBottom: '0.25rem' }}>{s.full_name}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="badge badge-primary">{s.role}</span>
                    <span className="badge badge-success">{s.staff_type}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', minHeight: '40px' }}>
                <strong>Quyền hạn:</strong> {s.role === 'shop_admin' ? 'Toàn quyền hệ thống' : (s.permissions?.length > 0 ? `${s.permissions.length} quyền đã cấp` : 'Chưa cấp quyền')}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button onClick={() => openEdit(s)} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}>
                  <ShieldCheck size={14} /> Phân quyền
                </button>
                <button className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--danger)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Phân Quyền */}
      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{editingId ? 'Chỉnh sửa & Phân quyền' : 'Thêm thành viên mới'}</h3>
              <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '2rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Họ và tên</label>
                  <input type="text" className="form-input" required value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Tên đăng nhập (Username)</label>
                  <input type="text" className="form-input" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Vai trò mặc định</label>
                  <select className="form-select" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as any})}>
                    <option value="staff">Nhân viên</option>
                    <option value="manager">Quản lý</option>
                    <option value="cashier">Thu ngân</option>
                    <option value="shop_admin">Admin Cửa hàng</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Phân loại công việc</label>
                  <select className="form-select" value={formData.staff_type} onChange={(e) => setFormData({...formData, staff_type: e.target.value})}>
                    <option value="technician">Chỉ làm kỹ thuật</option>
                    <option value="sales">Chỉ bán hàng</option>
                    <option value="both">Cả hai</option>
                  </select>
                </div>
              </div>

              {formData.role !== 'shop_admin' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={18} color="var(--primary)" /> Cấp quyền chi tiết
                  </h4>
                  <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    {['Bán hàng', 'Báo cáo', 'Vận hành'].map(group => (
                      <div key={group} style={{ gridColumn: group === 'Báo cáo' ? '1 / 3' : 'auto' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>{group}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {AVAILABLE_PERMISSIONS.filter(p => p.group === group).map(p => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: formData.permissions.includes(p.id) ? 'rgba(109, 40, 217, 0.05)' : 'transparent' }}>
                              <input 
                                type="checkbox" 
                                checked={formData.permissions.includes(p.id)} 
                                onChange={() => handleTogglePermission(p.id)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                              />
                              <span style={{ fontSize: '0.875rem' }}>{p.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
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

export default Staff;
