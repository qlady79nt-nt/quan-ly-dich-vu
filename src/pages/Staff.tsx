import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, Trash2, Loader2, ShieldCheck, X, Briefcase, KeyRound } from 'lucide-react';
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
  const { profile: currentUser, isRestricted } = useAuth();
  const shopId = currentUser?.shop_id;

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  const [staffFormData, setStaffFormData] = useState<any>({
    full_name: '',
    phone: '',
    position: 'technician',
    status: 'active'
  });

  const [accountFormData, setAccountFormData] = useState<any>({
    username: '',
    password: '',
    role: 'staff',
    permissions: [],
    profile_id: null // Biến lưu id của bảng profile nếu đã có tài khoản
  });

  useEffect(() => {
    if (currentUser) fetchStaff();
  }, [currentUser]);

  const fetchStaff = async () => {
    setLoading(true);
    // Fetch staffs và các tài khoản (profiles) liên kết với nó
    let query = supabase.from('staffs').select('*, profiles(id, username, role, status)').is('deleted_at', null).order('created_at', { ascending: false });

    if (currentUser?.role !== 'super_admin') {
      if (!shopId) { setLoading(false); return; }
      query = query.eq('shop_id', shopId);
    }

    const { data: staffsData, error } = await query;
    
    if (!error && staffsData) {
      // Vì bảng profiles có thể có nhiều, nhưng chuẩn 1-1 thì lấy phần tử đầu tiên
      const profileIds = staffsData.flatMap(s => s.profiles?.map((p: any) => p.id)).filter(Boolean);
      
      let permissionsMap: any = {};
      if (profileIds.length > 0) {
        const { data: perms } = await supabase.from('user_permissions').select('*').in('user_id', profileIds);
        if (perms) {
          perms.forEach(p => {
            if (!permissionsMap[p.user_id]) permissionsMap[p.user_id] = [];
            permissionsMap[p.user_id].push(p.permission);
          });
        }
      }

      const mappedStaff = staffsData.map(s => {
        const linkedProfile = s.profiles && s.profiles.length > 0 ? s.profiles[0] : null;
        if (linkedProfile) {
           linkedProfile.user_permissions = permissionsMap[linkedProfile.id] || [];
        }
        return {
          ...s,
          profile: linkedProfile
        };
      });
      setStaff(mappedStaff);
    } else {
      setStaff([]);
    }
    setLoading(false);
  };

  const handleTogglePermission = (permId: string) => {
    setAccountFormData((prev: any) => {
      const current = prev.permissions || [];
      const next = current.includes(permId)
        ? current.filter((p: string) => p !== permId)
        : [...current, permId];
      return { ...prev, permissions: next };
    });
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return alert('Lỗi: Không tìm thấy ID cửa hàng.');
    setSaving(true);
    
    const payload = { ...staffFormData, shop_id: shopId };
    let error;

    if (editingStaffId) {
      const { error: err } = await supabase.from('staffs').update(payload).eq('id', editingStaffId);
      error = err;
    } else {
      const { error: err } = await supabase.from('staffs').insert([payload]);
      error = err;
    }

    if (!error) {
      fetchStaff();
      closeStaffModal();
    } else {
      alert('Lỗi khi lưu nhân viên: ' + error.message);
    }
    setSaving(false);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || !editingStaffId) return;
    setSaving(true);

    const { username, password, role, permissions, profile_id } = accountFormData;
    
    let targetProfileId = profile_id;

    // 1. Tạo/Cập nhật profile
    if (targetProfileId) {
       // Đã có account, chỉ update
       const payload: any = { username, role };
       if (password) payload.password_hash = password; // Tùy logic auth của bạn
       
       const { error } = await supabase.from('profiles').update(payload).eq('id', targetProfileId);
       if (error) { alert('Lỗi sửa tài khoản: ' + error.message); setSaving(false); return; }
    } else {
       // Chưa có account, tạo mới
       // Lưu ý: Nếu hệ thống thật thì phải gọi Supabase Auth signUp, ở đây ta insert profile mô phỏng
       const { data, error } = await supabase.from('profiles').insert([{
          shop_id: shopId,
          staff_id: editingStaffId,
          username: username,
          role: role,
          status: 'active',
          full_name: staff.find(s => s.id === editingStaffId)?.full_name || 'User'
       }]).select().single();
       if (error) { alert('Lỗi tạo tài khoản: ' + error.message); setSaving(false); return; }
       targetProfileId = data.id;
    }

    // 2. Cập nhật phân quyền
    await supabase.from('user_permissions').delete().eq('user_id', targetProfileId);
    if (permissions && permissions.length > 0) {
      const permInserts = permissions.map((p: string) => ({ user_id: targetProfileId, permission: p }));
      await supabase.from('user_permissions').insert(permInserts);
    }

    fetchStaff();
    closeAccountModal();
    setSaving(false);
  };

  const openStaffEdit = (s: any) => {
    setEditingStaffId(s.id);
    setStaffFormData({
      full_name: s.full_name,
      phone: s.phone || '',
      position: s.position || 'technician',
      status: s.status
    });
    setIsStaffModalOpen(true);
  };

  const openAccountEdit = (s: any) => {
    setEditingStaffId(s.id);
    if (s.profile) {
      setAccountFormData({
        username: s.profile.username || '',
        password: '',
        role: s.profile.role || 'staff',
        permissions: s.profile.user_permissions || [],
        profile_id: s.profile.id
      });
    } else {
      setAccountFormData({
        username: '',
        password: '',
        role: 'staff',
        permissions: [],
        profile_id: null
      });
    }
    setIsAccountModalOpen(true);
  };

  const closeStaffModal = () => {
    setIsStaffModalOpen(false);
    setEditingStaffId(null);
    setStaffFormData({ full_name: '', phone: '', position: 'technician', status: 'active' });
  };

  const closeAccountModal = () => {
    setIsAccountModalOpen(false);
    setEditingStaffId(null);
    setAccountFormData({ username: '', password: '', role: 'staff', permissions: [], profile_id: null });
  };

  const handleDelete = async (id: string) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    if (!window.confirm('Bạn có chắc chắn muốn xoá nhân sự này? (Xoá mềm, không mất dữ liệu cũ)')) return;
    
    setLoading(true);
    const { error } = await supabase.from('staffs').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (!error) {
      fetchStaff();
    } else {
      alert('Lỗi khi xoá: ' + error.message);
      setLoading(false);
    }
  };

  const filteredStaff = staff.filter(s => 
    (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.profile?.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Nhân sự & Tài khoản</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Quản lý hồ sơ vận hành và cấp quyền hệ thống</p>
        </div>
        <button 
          onClick={() => setIsStaffModalOpen(true)} 
          className="btn btn-primary"
          disabled={isRestricted()}
          title={isRestricted() ? 'Vui lòng gia hạn gói dịch vụ' : ''}
        >
          <UserPlus size={18} />
          Thêm nhân sự mới
        </button>
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Tìm theo tên nhân viên..." 
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
            <div key={s.id} className="premium-card" style={{ borderTop: s.profile?.role === 'shop_admin' ? '4px solid var(--secondary)' : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                  {(s.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ marginBottom: '0.25rem' }}>{s.full_name}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span className="badge badge-success" style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)' }}><Briefcase size={12} style={{ display: 'inline', marginRight: '4px' }}/>{s.position}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                   <KeyRound size={14} color={s.profile ? 'var(--success)' : 'var(--text-light)'} /> 
                   <strong style={{ color: s.profile ? 'var(--text-main)' : 'inherit' }}>Tài khoản:</strong> 
                   {s.profile ? s.profile.username || 'Đã cấp' : 'Chưa có tài khoản'}
                </div>
                {s.profile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={14} color="var(--primary)" />
                    <strong>Quyền hạn:</strong> {s.profile.role === 'shop_admin' ? 'Toàn quyền (Admin)' : `${s.profile.user_permissions?.length || 0} quyền`}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button onClick={() => openStaffEdit(s)} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem', background: 'transparent' }}>
                  Sửa Hồ sơ
                </button>
                <button onClick={() => openAccountEdit(s)} className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}>
                  {s.profile ? 'Sửa Quyền' : 'Cấp Account'}
                </button>
                <button onClick={() => handleDelete(s.id)} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--danger)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal 1: Hồ sơ Nhân Sự (Staff) */}
      {isStaffModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{editingStaffId ? 'Chỉnh sửa Hồ sơ' : 'Thêm Nhân sự mới'}</h3>
              <button type="button" onClick={closeStaffModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSaveStaff}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Họ và tên thực tế <span className="text-danger">*</span></label>
                <input type="text" className="form-input" required value={staffFormData.full_name} onChange={(e) => setStaffFormData({...staffFormData, full_name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Số điện thoại</label>
                <input type="text" className="form-input" value={staffFormData.phone} onChange={(e) => setStaffFormData({...staffFormData, phone: e.target.value})} />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Vị trí / Chức vụ</label>
                <select className="form-select" value={staffFormData.position} onChange={(e) => setStaffFormData({...staffFormData, position: e.target.value})}>
                  <option value="technician">Kỹ thuật viên</option>
                  <option value="receptionist">Lễ tân</option>
                  <option value="manager">Quản lý</option>
                  <option value="collaborator">Cộng tác viên</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={closeStaffModal} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Lưu Hồ Sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* Modal 2: Cấp Tài khoản & Phân quyền (Account) */}
      {isAccountModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Cấp tài khoản hệ thống</h3>
              <button type="button" onClick={closeAccountModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSaveAccount}>
              <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '2rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Tên đăng nhập (Username)</label>
                  <input type="text" className="form-input" required value={accountFormData.username} onChange={(e) => setAccountFormData({...accountFormData, username: e.target.value})} placeholder="VD: ngoc.letan" />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Mật khẩu (Để trống nếu giữ nguyên)</label>
                  <input type="password" className="form-input" value={accountFormData.password} onChange={(e) => setAccountFormData({...accountFormData, password: e.target.value})} placeholder="******" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Vai trò mặc định</label>
                  <select className="form-select" value={accountFormData.role} onChange={(e) => setAccountFormData({...accountFormData, role: e.target.value as any})}>
                    <option value="staff">Nhân viên thông thường</option>
                    <option value="manager">Quản lý cấp trung</option>
                    <option value="shop_admin">Admin Cửa hàng (Toàn quyền)</option>
                  </select>
                </div>
              </div>

              {accountFormData.role !== 'shop_admin' && (
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
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: accountFormData.permissions.includes(p.id) ? 'rgba(109, 40, 217, 0.05)' : 'transparent' }}>
                              <input 
                                type="checkbox" 
                                checked={accountFormData.permissions.includes(p.id)} 
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
                <button type="button" onClick={closeAccountModal} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Lưu Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default Staff;
