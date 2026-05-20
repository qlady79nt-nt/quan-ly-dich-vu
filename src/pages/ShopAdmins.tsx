import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, ShieldAlert, ShieldCheck, Loader2, X, KeyRound, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../lib/auth';

const ShopAdmins = () => {
  useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    shop_id: ''
  });

  const [passwordData, setPasswordData] = useState({
    userId: '',
    username: '',
    newPassword: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, shopsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, shops(id, name, shop_code)')
        .eq('role', 'shop_admin')
        .order('created_at', { ascending: false }),
      supabase
        .from('shops')
        .select('id, name, shop_code')
        .eq('status', 'active')
    ]);

    if (profilesRes.data) setAdmins(profilesRes.data);
    if (shopsRes.data) setShops(shopsRes.data);
    setLoading(false);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shop_id) return alert('Vui lòng chọn cửa hàng.');
    if (formData.username.includes(' ')) return alert('Tên đăng nhập không được chứa khoảng trắng.');
    if (formData.password.length < 6) return alert('Mật khẩu phải tối thiểu 6 ký tự.');

    setSaving(true);

    try {
      const selectedShop = shops.find(s => s.id === formData.shop_id);
      if (!selectedShop) throw new Error('Không tìm thấy thông tin cửa hàng.');

      // 1. Kiểm tra xem username đã tồn tại chưa
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('shop_id', formData.shop_id)
        .eq('username', formData.username)
        .maybeSingle();

      if (existingProfile) {
        throw new Error('Tên đăng nhập này đã tồn tại tại cửa hàng đã chọn. Vui lòng chọn tên khác.');
      }

      // 2. Tạo email ảo hệ thống theo quy chuẩn
      const fakeEmail = `${formData.username.toLowerCase()}@${selectedShop.shop_code.toLowerCase()}.spa.local`;

      // 3. Khởi tạo client phụ để tránh override session của Super Admin hiện tại
      const secondaryClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );

      // 4. Đăng ký auth.users
      const { data: authData, error: authErr } = await secondaryClient.auth.signUp({
        email: fakeEmail,
        password: formData.password
      });

      if (authErr) {
        if (authErr.message.toLowerCase().includes('already registered')) {
          throw new Error('Tên đăng nhập này đã được sử dụng trước đây. Vui lòng chọn tên khác!');
        }
        throw authErr;
      }

      if (!authData.user) throw new Error('Không thể khởi tạo tài khoản xác thực.');

      // 5. Thêm profile dưới quyền shop_admin, staff_id là NULL (Tách biệt Business Owner và Operational Staff)
      const { error: profErr } = await supabase.from('profiles').insert([
        {
          id: authData.user.id,
          shop_id: formData.shop_id,
          username: formData.username.toLowerCase(),
          full_name: formData.full_name || 'Chủ cửa hàng',
          role: 'shop_admin',
          status: 'active',
          staff_id: null
        }
      ]);

      if (profErr) throw profErr;

      // 6. Cấp quyền mặc định cho Shop Admin
      await supabase.from('user_permissions').insert([
        { user_id: authData.user.id, permission: 'sale.create' },
        { user_id: authData.user.id, permission: 'sale.discount' },
        { user_id: authData.user.id, permission: 'report.view' }
      ]);

      alert('Đã tạo tài khoản Shop Admin thành công!');
      closeAddModal();
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Có lỗi xảy ra.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword.length < 6) return alert('Mật khẩu mới phải tối thiểu 6 ký tự.');

    setSaving(true);
    const { error } = await supabase.rpc('update_auth_user_password', {
      target_user_id: passwordData.userId,
      new_password: passwordData.newPassword
    });

    if (!error) {
      alert(`Đã đổi mật khẩu thành công cho tài khoản "${passwordData.username}"!`);
      closePasswordModal();
    } else {
      alert('Lỗi khi đổi mật khẩu: ' + error.message);
    }
    setSaving(false);
  };

  const handleToggleStatus = async (admin: any) => {
    const isLocked = admin.status === 'inactive';
    const action = isLocked ? 'MỞ KHÓA' : 'KHÓA';
    if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản "${admin.username}"?`)) return;

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ status: isLocked ? 'active' : 'inactive' })
      .eq('id', admin.id);

    if (!error) {
      fetchData();
    } else {
      alert('Lỗi: ' + error.message);
    }
    setLoading(false);
  };

  const handleDeleteAdmin = async (admin: any) => {
    if (!window.confirm(`XÓA VĨNH VIỄN tài khoản Shop Admin "${admin.username}"?\n\nChú ý: Hành động này sẽ xóa sạch tài khoản auth và profile liên quan. Dữ liệu vận hành của Shop sẽ KHÔNG bị ảnh hưởng.`)) return;

    setLoading(true);
    const { error } = await supabase.rpc('delete_auth_user', { target_user_id: admin.id });

    if (!error) {
      alert('Đã xóa vĩnh viễn tài khoản thành công!');
      fetchData();
    } else {
      alert('Lỗi khi xóa tài khoản: ' + error.message);
    }
    setLoading(false);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setFormData({ username: '', password: '', full_name: '', shop_id: '' });
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordData({ userId: '', username: '', newPassword: '' });
  };

  const openPasswordModal = (admin: any) => {
    setPasswordData({
      userId: admin.id,
      username: admin.username,
      newPassword: ''
    });
    setIsPasswordModalOpen(true);
  };

  const filteredAdmins = admins.filter(a =>
    a.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.shops?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Tài khoản Shop Admin</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Phân cấp hệ thống: Quản lý tài khoản Chủ cửa hàng (Tenant Owner) - Tách biệt với nhân viên KTV nội bộ.
          </p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
          <UserPlus size={18} />
          Tạo Shop Admin mới
        </button>
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Tìm theo username, tên chủ shop hoặc tên cửa hàng..."
            style={{ paddingLeft: '2.75rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="premium-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Tên đăng nhập</th>
                <th>Họ và tên</th>
                <th>Cửa hàng</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin) => (
                <tr key={admin.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                  <td style={{ padding: '1rem', fontWeight: '700', color: 'var(--primary)' }}>
                    {admin.username}
                  </td>
                  <td style={{ fontWeight: '500' }}>{admin.full_name}</td>
                  <td>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{admin.shops?.name || '---'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Mã: {admin.shops?.shop_code || '---'}</div>
                  </td>
                  <td>
                    {admin.created_at ? new Date(admin.created_at).toLocaleDateString('vi-VN') : '---'}
                  </td>
                  <td>
                    {admin.status === 'inactive' ? (
                      <span className="badge badge-danger">Đang khóa</span>
                    ) : (
                      <span className="badge badge-success">Hoạt động</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openPasswordModal(admin)}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title="Đổi mật khẩu"
                      >
                        <KeyRound size={14} />
                        Đổi MK
                      </button>

                      {admin.status === 'inactive' ? (
                        <button
                          onClick={() => handleToggleStatus(admin)}
                          className="btn"
                          style={{ padding: '0.4rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }}
                          title="Mở khóa tài khoản"
                        >
                          <ShieldCheck size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(admin)}
                          className="btn"
                          style={{ padding: '0.4rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)' }}
                          title="Khóa tài khoản"
                        >
                          <ShieldAlert size={16} />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteAdmin(admin)}
                        className="btn"
                        style={{ padding: '0.4rem', color: 'var(--danger)', background: 'transparent' }}
                        title="Xóa vĩnh viễn"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAdmins.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Không tìm thấy Shop Admin nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Thêm Mới */}
      {isAddModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Tạo Shop Admin mới</h3>
              <button type="button" onClick={closeAddModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleCreateAdmin}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label className="form-label">Chọn cửa hàng (Tenant)</label>
                  <select
                    className="form-select"
                    required
                    value={formData.shop_id}
                    onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
                  >
                    <option value="">-- Chọn cửa hàng --</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.shop_code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Tên đăng nhập (Username)</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="Ví dụ: hoa.admin, spahanh..."
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/\s/g, '').toLowerCase() })}
                  />
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>Tên đăng nhập viết liền, không dấu, không khoảng trắng.</p>
                </div>

                <div>
                  <label className="form-label">Mật khẩu ban đầu</label>
                  <input
                    type="password"
                    className="form-input"
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Họ và tên chủ shop</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={closeAddModal} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Đổi Mật Khẩu */}
      {isPasswordModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Đổi mật khẩu Shop Admin</h3>
              <button type="button" onClick={closePasswordModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                  Đang đổi mật khẩu cho tài khoản: <strong>{passwordData.username}</strong>
                </div>

                <div>
                  <label className="form-label">Mật khẩu mới</label>
                  <input
                    type="password"
                    className="form-input"
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={closePasswordModal} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Cập nhật mật khẩu'}
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

export default ShopAdmins;
