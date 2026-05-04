import { useState, useEffect } from 'react';
import { Save, UserCheck, Shield, Trash2, Loader2, Users, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const ManageUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [planData, setPlanData] = useState<any>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  // Form tạo user mới
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: '',
    username: '',
    password: '',
    role: 'staff'
  });

  // Phân nhóm quyền hạn rõ ràng
  const permissionGroups = [
    {
      title: 'BÁN HÀNG & THU NGÂN',
      perms: [
        { id: 'sale.create', label: 'Tạo đơn hàng (sale.create)' },
        { id: 'sale.edit', label: 'Sửa đơn (sale.edit)' },
        { id: 'sale.delete', label: 'Xóa đơn (sale.delete)' },
        { id: 'sale.discount', label: 'Cho phép Giảm giá (sale.discount)' },
        { id: 'invoice.print', label: 'In hoá đơn (invoice.print)' },
      ]
    },
    {
      title: 'BÁO CÁO & PHÂN TÍCH',
      perms: [
        { id: 'report.revenue.view', label: 'Xem doanh thu (report.revenue.view)' },
        { id: 'report.invoice.view', label: 'Xem danh sách hoá đơn (report.invoice.view)' },
        { id: 'report.commission.view', label: 'Xem hoa hồng (report.commission.view)' },
      ]
    }
  ];

  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectUser = async (user: any) => {
    if (!user) return;
    setSelectedUser(user);
    try {
      const { data: perms } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id);
        
      if (perms) {
        setSelectedPerms(perms.map(p => p.permission));
      } else {
        setSelectedPerms([]);
      }
    } catch (error) {
      console.error('Error fetching perms:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (adminProfile?.shop_id) {
        setShopId(adminProfile.shop_id);
        setCurrentUserProfile(adminProfile);

        // Fetch Users
        const { data: shopUsers } = await supabase
          .from('profiles')
          .select('*')
          .eq('shop_id', adminProfile.shop_id)
          .neq('role', 'super_admin');

        setUsers(shopUsers || []);

        // Tự động chọn nhân viên đầu tiên nếu chưa chọn ai
        if (shopUsers && shopUsers.length > 0 && !selectedUser) {
          handleSelectUser(shopUsers[0]);
        }

        // Fetch Plan Limits
        const { data: shopInfo } = await supabase
          .from('shops')
          .select('plans(max_users)')
          .eq('id', adminProfile.shop_id)
          .single();
          
        if (shopInfo?.plans) {
          setPlanData(shopInfo.plans);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePerm = (id: string) => {
    setSelectedPerms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  // AUDIT LOG FUNCTION
  const logAudit = async (action: string, targetUserId: string, data: any) => {
    try {
      await supabase.from('audit_logs').insert({
        shop_id: shopId,
        action,
        actor_user_id: currentUserProfile?.id,
        target_user_id: targetUserId,
        data
      });
    } catch (e) {
      console.error("Audit log failed", e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    
    if (activeUsersCount >= maxUsers) {
      return alert('Đã đạt giới hạn nhân viên của gói dịch vụ! Vui lòng nâng cấp gói.');
    }

    setCreating(true);
    try {
      // 1. Gọi RPC để tạo user ngầm qua Fake Email Strategy
      const { data: newUserId, error } = await supabase.rpc('create_staff_user', {
        p_shop_id: shopId,
        p_username: newUser.username.toLowerCase().trim(),
        p_password: newUser.password,
        p_full_name: newUser.fullName,
        p_role: newUser.role
      });

      if (error) {
        if (error.message.includes('unique constraint')) {
          throw new Error('Tên đăng nhập này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.');
        }
        throw error;
      }

      await logAudit('create_user', newUserId, { username: newUser.username, role: newUser.role });

      alert('Đã tạo tài khoản nhân viên thành công!');
      setNewUser({ fullName: '', username: '', password: '', role: 'staff' });
      fetchData(); // Refresh list
    } catch (error: any) {
      alert('Lỗi khi tạo nhân viên: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSavePerms = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      // 1. AN TOÀN: Xóa các quyền bị bỏ tick (Delete only what's unchecked)
      if (selectedPerms.length > 0) {
        await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', selectedUser.id)
          .not('permission', 'in', `(${selectedPerms.join(',')})`);
      } else {
        // Xóa hết nếu không chọn gì
        await supabase.from('user_permissions').delete().eq('user_id', selectedUser.id);
      }

      // 2. AN TOÀN: UPSERT các quyền được tick
      if (selectedPerms.length > 0) {
        const inserts = selectedPerms.map(p => ({
          user_id: selectedUser.id,
          permission: p
        }));
        await supabase.from('user_permissions').upsert(inserts, { onConflict: 'user_id,permission' });
      }

      // 3. Cập nhật role & status
      await supabase
        .from('profiles')
        .update({ role: selectedUser.role, status: selectedUser.status })
        .eq('id', selectedUser.id);

      // 4. Ghi Audit Log
      await logAudit('update_permissions', selectedUser.id, { role: selectedUser.role, status: selectedUser.status, perms: selectedPerms });

      alert('Đã cập nhật cấu hình nhân sự thành công!');
      fetchData(); // Refresh list
    } catch (error: any) {
      alert('Lỗi khi lưu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDeleteUser = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc muốn vô hiệu hoá nhân viên này? (Họ sẽ không thể truy cập hệ thống, nhưng vẫn giữ lịch sử làm việc)')) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inactive' }) // SOFT DELETE
        .eq('id', userId);
        
      if (error) throw error;
      
      await logAudit('deactivate_user', userId, { reason: 'Soft delete by admin' });
      
      if (selectedUser?.id === userId) setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      alert('Lỗi: ' + error.message);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /> Đang tải dữ liệu nhân sự...</div>;

  if (!shopId) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'white', borderRadius: '1rem', boxShadow: 'var(--shadow-md)' }}>
        <h2 style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>Thiếu thông tin Shop!</h2>
        <p>Tài khoản của bạn chưa được liên kết với cửa hàng nào. Vui lòng vào mục <strong>Cấu hình Shop</strong> để kích hoạt trước.</p>
      </div>
    );
  }

  const activeUsersCount = users.filter(u => u.status !== 'inactive').length;
  const maxUsers = planData?.max_users || 1;
  const isLimitReached = activeUsersCount >= maxUsers;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '400px', backgroundColor: isLimitReached ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: `1px solid ${isLimitReached ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}` }}>
          <Users size={24} color={isLimitReached ? 'var(--danger-color)' : 'var(--success-color)'} />
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <strong style={{ color: isLimitReached ? 'var(--danger-color)' : 'var(--success-color)' }}>Sử dụng Gói (Nhân sự hoạt động)</strong>
              <strong>{activeUsersCount} / {maxUsers}</strong>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--background-light)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', backgroundColor: isLimitReached ? 'var(--danger-color)' : 'var(--success-color)', width: `${Math.min(100, (activeUsersCount / maxUsers) * 100)}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
        {/* CỘT TRÁI: FORM TẠO & DANH SÁCH */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* TẠO NHÂN VIÊN MỚI */}
          <div className="premium-card">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={24} />
              Tạo Nhân Viên Mới
            </h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Tên hiển thị</label>
                <input 
                  type="text" className="form-input" placeholder="Ví dụ: Nguyễn Văn A" 
                  value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tên đăng nhập (Username)</label>
                <input 
                  type="text" className="form-input" placeholder="Ví dụ: nva123" 
                  value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required 
                  style={{ textTransform: 'lowercase' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Mật khẩu</label>
                  <input 
                    type="password" className="form-input" placeholder="••••••••" 
                    value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vai trò</label>
                  <select 
                    className="form-select" 
                    value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}
                  >
                    <option value="staff">Kỹ thuật viên</option>
                    <option value="manager">Quản lý nhánh</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={creating || isLimitReached} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {creating ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
                {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </form>
          </div>

          {/* DANH SÁCH NHÂN VIÊN */}
          <div className="premium-card">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={24} />
              Hồ Sơ Nhân Sự ({users.length})
            </h2>
            
            {users.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem 0' }}>Chưa có nhân sự nào.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {users.map(u => (
                  <div 
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    style={{ 
                      padding: '1rem', 
                      borderRadius: '0.5rem', 
                      border: selectedUser?.id === u.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      backgroundColor: selectedUser?.id === u.id ? 'var(--background-light)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: u.status === 'inactive' ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block' }}>
                        {u.full_name || 'Nhân viên vô danh'}
                        {u.status === 'inactive' && ' (Đã nghỉ)'}
                      </strong>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span className={`badge ${u.role === 'shop_admin' ? 'badge-primary' : 'badge-success'}`}>
                          {u.role === 'shop_admin' ? 'Quản lý' : 'Nhân viên'}
                        </span>
                        {u.status === 'inactive' && <span className="badge badge-danger">Inactive</span>}
                      </div>
                    </div>
                    {u.role !== 'shop_admin' && u.status !== 'inactive' && (
                      <button 
                        onClick={(e) => handleSoftDeleteUser(e, u.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '0.5rem' }}
                        title="Vô hiệu hoá"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: CẤU HÌNH PHÂN QUYỀN */}
        <div className="premium-card" style={{ opacity: selectedUser ? 1 : 0.5, pointerEvents: selectedUser ? 'auto' : 'none', alignSelf: 'start' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={24} />
            Phân Quyền: {selectedUser?.full_name || '...'}
          </h2>
          
          {!selectedUser ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-light)' }}>
              Hãy chọn một nhân viên bên trái để xem và sửa quyền
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Vai trò chính (Role)</label>
                  <select 
                    className="form-select" 
                    value={selectedUser.role} 
                    onChange={e => setSelectedUser({...selectedUser, role: e.target.value})}
                    disabled={selectedUser.role === 'shop_admin' && selectedUser.id === currentUserProfile?.id} 
                  >
                    <option value="staff">Kỹ thuật viên (Staff)</option>
                    <option value="manager">Quản lý nhánh (Manager)</option>
                    <option value="shop_admin">Chủ cơ sở (Shop Admin)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Trạng thái (Status)</label>
                  <select 
                    className="form-select" 
                    value={selectedUser.status || 'active'} 
                    onChange={e => setSelectedUser({...selectedUser, status: e.target.value})}
                    disabled={selectedUser.id === currentUserProfile?.id}
                  >
                    <option value="active">Đang làm việc (Active)</option>
                    <option value="inactive">Đã nghỉ (Inactive)</option>
                  </select>
                </div>
              </div>

              <label className="form-label" style={{ marginTop: '1.5rem' }}>Quyền hạn chuyên sâu (Permissions)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {permissionGroups.map(group => (
                  <div key={group.title} style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      {group.title}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                      {group.perms.map(perm => (
                        <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedPerms.includes(perm.id)}
                            onChange={() => togglePerm(perm.id)}
                            style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary-color)' }}
                          />
                          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={handleSavePerms} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  {saving ? 'Đang lưu...' : 'Lưu cấu hình nhân sự'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageUsers;
