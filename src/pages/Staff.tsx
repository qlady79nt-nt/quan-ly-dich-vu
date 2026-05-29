import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, Trash2, Loader2, ShieldCheck, X, Briefcase, KeyRound, Lock, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../lib/auth';

const AVAILABLE_PERMISSIONS = [
  // Nhóm Bán hàng
  { id: 'sale.create', label: 'Tạo hoá đơn', group: 'Bán hàng' },
  { id: 'sale.checkout', label: 'Thanh toán', group: 'Bán hàng' },
  { id: 'sale.discount', label: 'Giảm giá', group: 'Bán hàng' },
  { id: 'invoice.print', label: 'In hoá đơn', group: 'Bán hàng' },
  { id: 'invoice.edit', label: 'Sửa hoá đơn', group: 'Bán hàng' },
  { id: 'invoice.cancel', label: 'Huỷ hoá đơn', group: 'Bán hàng' },
  
  // Nhóm Khách hàng
  { id: 'customer.view', label: 'Xem danh sách', group: 'Khách hàng' },
  { id: 'customer.create', label: 'Thêm khách hàng', group: 'Khách hàng' },
  { id: 'customer.edit', label: 'Sửa khách hàng', group: 'Khách hàng' },
  { id: 'package.manage', label: 'Quản lý Liệu trình', group: 'Khách hàng' },

  // Nhóm Giường & Điều phối
  { id: 'beds.view', label: 'Xem sơ đồ giường', group: 'Giường & Điều phối' },
  { id: 'beds.assign', label: 'Xếp giường/KTV', group: 'Giường & Điều phối' },
  { id: 'beds.manage', label: 'Quản lý giường', group: 'Giường & Điều phối' },

  // Nhóm Báo cáo
  { id: 'report.daily.view', label: 'Xem BC ngày', group: 'Báo cáo' },
  { id: 'report.revenue.view', label: 'Xem BC doanh thu', group: 'Báo cáo' },
  { id: 'report.profit.view', label: 'Xem BC lợi nhuận', group: 'Báo cáo' },
  { id: 'report.staff.view', label: 'Xem BC nhân viên', group: 'Báo cáo' },
  { id: 'commission.view', label: 'Xem hoa hồng', group: 'Báo cáo' },

  // Nhóm Nhân sự
  { id: 'staff.manage', label: 'Quản lý Hồ sơ', group: 'Nhân sự' },
  { id: 'account.manage', label: 'Quản lý Tài khoản', group: 'Nhân sự' },

  // Nhóm Cài đặt
  { id: 'settings.edit', label: 'Cài đặt hệ thống', group: 'Cài đặt' },
  { id: 'shop.edit', label: 'Cài đặt cửa hàng', group: 'Cài đặt' },
  { id: 'service.manage', label: 'Quản lý Dịch vụ', group: 'Cài đặt' },
];

const PRESETS: Record<string, string[]> = {
  staff: [
    'sale.create', 'sale.checkout', 'invoice.print', 
    'customer.view', 'customer.create', 
    'beds.view', 'beds.assign'
  ],
  manager: [
    'sale.create', 'sale.checkout', 'sale.discount', 'invoice.print', 'invoice.edit',
    'customer.view', 'customer.create', 'customer.edit', 'package.manage',
    'beds.view', 'beds.assign', 'beds.manage',
    'report.daily.view', 'report.revenue.view', 'report.staff.view', 'commission.view',
    'staff.manage'
  ]
};

const Staff = () => {
  const { profile: currentUser, isRestricted } = useAuth();
  const shopId = currentUser?.shop_id;

  const [activeTab, setActiveTab] = useState<'staffs' | 'accounts'>('staffs');
  
  const [staff, setStaff] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

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
    staff_id: ''
  });

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    
    let staffsQuery = supabase.from('staffs').select('*').order('created_at', { ascending: false });
    let profilesQuery = supabase.from('profiles').select('*, staffs(full_name, position)').order('created_at', { ascending: false });
    
    if (currentUser?.role !== 'super_admin') {
      if (!shopId) { setLoading(false); return; }
      staffsQuery = staffsQuery.eq('shop_id', shopId);
      profilesQuery = profilesQuery.eq('shop_id', shopId);
    }

    const [staffsRes, profilesRes] = await Promise.all([staffsQuery, profilesQuery]);
    
    if (staffsRes.data) {
      setStaff(staffsRes.data);
    } else {
      setStaff([]);
    }
    
    if (profilesRes.data) {
      const profileIds = profilesRes.data.map(p => p.id);
      let permsMap: any = {};
      if (profileIds.length > 0) {
        const { data: perms } = await supabase.from('user_permissions').select('*').in('user_id', profileIds);
        if (perms) {
          perms.forEach(p => {
            if (!permsMap[p.user_id]) permsMap[p.user_id] = [];
            permsMap[p.user_id].push(p.permission);
          });
        }
      }
      
      const mappedProfiles = profilesRes.data.map(p => ({
        ...p,
        user_permissions: permsMap[p.id] || []
      }));
      setAccounts(mappedProfiles);
    } else {
      setAccounts([]);
    }
    
    setLoading(false);
  };

  // --- STAFF ACTIONS ---
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return alert('Lỗi: Không tìm thấy ID cửa hàng.');
    
    // Kiểm tra giới hạn số lượng nhân sự của gói
    if (!editingStaffId && currentUser?.role !== 'super_admin') {
      const maxStaffs = currentUser?.shop?.plans?.max_staffs || 3;
      const activeStaffsCount = staff.filter(s => s.status !== 'inactive').length;
      if (activeStaffsCount >= maxStaffs) {
        return alert(`Gói hiện tại của bạn chỉ cho phép tối đa ${maxStaffs} nhân sự hoạt động. Vui lòng nâng cấp gói hoặc chuyển bớt nhân sự cũ sang trạng thái nghỉ làm.`);
      }
    }
    
    setSaving(true);
    
    const payload = { ...staffFormData, shop_id: shopId };
    let error;

    if (editingStaffId) {
      const { error: err } = await supabase.from('staffs').update(payload).eq('id', editingStaffId);
      error = err;
      
      // Đồng bộ tên sang bảng profiles nếu có account liên kết
      if (!error && payload.full_name) {
         await supabase.from('profiles').update({ full_name: payload.full_name }).eq('staff_id', editingStaffId);
      }
    } else {
      const { error: err } = await supabase.from('staffs').insert([payload]);
      error = err;
    }

    if (!error) {
      fetchData();
      closeStaffModal();
    } else {
      alert('Lỗi khi lưu nhân viên: ' + error.message);
    }
    setSaving(false);
  };

  const handleToggleStaffStatus = async (s: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    const isInactive = s.status === 'inactive';
    
    // Nếu khôi phục nhân sự từ nghỉ làm sang đang làm, cần kiểm tra giới hạn gói
    if (isInactive && currentUser?.role !== 'super_admin') {
      const maxStaffs = currentUser?.shop?.plans?.max_staffs || 3;
      const activeStaffsCount = staff.filter(st => st.status !== 'inactive').length;
      if (activeStaffsCount >= maxStaffs) {
        return alert(`Gói hiện tại của bạn chỉ cho phép tối đa ${maxStaffs} nhân sự hoạt động. Vui lòng nâng cấp gói để khôi phục hoạt động cho nhân sự này.`);
      }
    }

    const action = isInactive ? 'Khôi phục' : 'Cho nghỉ';
    if (!window.confirm(`Bạn có chắc chắn muốn ${action.toLowerCase()} nhân sự này?`)) return;
    
    setLoading(true);
    const { error } = await supabase.from('staffs').update({ status: isInactive ? 'active' : 'inactive' }).eq('id', s.id);
    if (!error) {
      // Tự động khóa/mở khóa tài khoản liên kết nếu có
      await supabase.from('profiles').update({ status: isInactive ? 'active' : 'inactive' }).eq('staff_id', s.id);
      fetchData();
    } else {
      alert(`Lỗi: ` + error.message);
    }
    setLoading(false);
  };

  const handleHardDeleteStaff = async (id: string) => {
    if (currentUser?.role !== 'super_admin') return;
    if (!window.confirm('XÓA VĨNH VIỄN nhân sự này? (SUPER ADMIN)')) return;
    setLoading(true);
    const { error } = await supabase.from('staffs').delete().eq('id', id);
    if (!error) fetchData();
    else alert('Lỗi: ' + error.message);
    setLoading(false);
  };

  // --- ACCOUNT ACTIONS ---
  const handleTogglePermission = (permId: string) => {
    setAccountFormData((prev: any) => {
      const current = prev.permissions || [];
      const next = current.includes(permId) ? current.filter((p: string) => p !== permId) : [...current, permId];
      return { ...prev, permissions: next };
    });
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    // Tự động nạp Permission Preset khi đổi vai trò
    setAccountFormData((prev: any) => ({
      ...prev,
      role: newRole,
      permissions: PRESETS[newRole] || []
    }));
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;

    // Kiểm tra giới hạn số lượng tài khoản đăng nhập của gói
    if (!editingAccountId && currentUser?.role !== 'super_admin') {
      const maxUsers = currentUser?.shop?.plans?.max_users || 1;
      const activeAccountsCount = accounts.filter(a => a.status !== 'inactive').length;
      if (activeAccountsCount >= maxUsers) {
        return alert(`Gói hiện tại của bạn chỉ cho phép tối đa ${maxUsers} tài khoản đăng nhập hoạt động. Vui lòng nâng cấp gói hoặc khóa bớt tài khoản khác.`);
      }
    }

    setSaving(true);

    const { username, password, role, permissions, staff_id } = accountFormData;
    let targetProfileId = editingAccountId;

    const staffName = staff.find(s => s.id === staff_id)?.full_name || username;
    const payload: any = { 
       role,
       staff_id: staff_id || null,
       full_name: staffName
    };

    if (targetProfileId) {
        if (password) {
            const { error: pwdErr } = await supabase.rpc('update_auth_user_password', {
                target_user_id: targetProfileId,
                new_password: password
            });
            if (pwdErr) {
                alert('Không thể cập nhật mật khẩu mới: ' + pwdErr.message);
                setSaving(false); return;
            }
        }
        const { error } = await supabase.from('profiles').update(payload).eq('id', targetProfileId);
       if (error) { alert('Lỗi sửa tài khoản: ' + error.message); setSaving(false); return; }
    } else {
       const shopCode = currentUser?.shop?.shop_code;
       if (!shopCode) {
           alert('Không tìm thấy mã cửa hàng, không thể tạo email cho hệ thống.');
           setSaving(false); return;
       }

       if (!password) {
           alert('Vui lòng nhập mật khẩu cho tài khoản mới.');
           setSaving(false); return;
       }

       // Kiểm tra xem username đã tồn tại trong bảng profiles chưa
       const { data: existingProfile } = await supabase
         .from('profiles')
         .select('id, status')
         .eq('shop_id', shopId)
         .eq('username', username)
         .maybeSingle();

       if (existingProfile) {
           const msg = existingProfile.status === 'inactive' 
             ? 'Tên đăng nhập này đã tồn tại (tài khoản đang bị khóa). Vui lòng chọn tên khác hoặc mở khóa tài khoản cũ.'
             : 'Tên đăng nhập này đã tồn tại. Vui lòng chọn tên khác.';
           alert(msg);
           setSaving(false); return;
       }

       const fakeEmail = `${username.toLowerCase()}@${shopCode.toLowerCase()}.spa.local`;

       const secondaryClient = createClient(
           import.meta.env.VITE_SUPABASE_URL,
           import.meta.env.VITE_SUPABASE_ANON_KEY,
           { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
       );

       const { data: authData, error: authErr } = await secondaryClient.auth.signUp({
           email: fakeEmail,
           password: password
       });

       if (authErr) {
           if (authErr.message.toLowerCase().includes('already registered')) {
               alert('Tên đăng nhập này đã từng được sử dụng (có thể đã xóa hồ sơ nhưng vẫn kẹt trong hệ thống). Vui lòng chọn tên đăng nhập khác!');
           } else {
               alert('Lỗi tạo tài khoản hệ thống (Auth): ' + authErr.message);
           }
           setSaving(false); return;
       }
       
       if (!authData.user) {
           alert('Không thể tạo tài khoản xác thực.');
           setSaving(false); return;
       }

       payload.username = username;
       payload.id = authData.user.id;
       payload.shop_id = shopId;
       payload.status = 'active';
       
       const { error } = await supabase.from('profiles').insert([payload]);
       if (error) { alert('Lỗi tạo profile: ' + error.message); setSaving(false); return; }
       targetProfileId = payload.id;
    }

    const { error: delErr } = await supabase.from('user_permissions').delete().eq('user_id', targetProfileId);
    if (delErr) {
      alert('Lỗi xóa quyền cũ (Có thể do lỗi phân quyền RLS Database): ' + delErr.message);
    } else if (permissions && permissions.length > 0) {
      const permInserts = permissions.map((p: string) => ({ user_id: targetProfileId, permission: p }));
      const { error: insErr } = await supabase.from('user_permissions').insert(permInserts);
      if (insErr) alert('Lỗi lưu quyền mới: ' + insErr.message);
    }

    fetchData();
    closeAccountModal();
    setSaving(false);
  };

  const handleToggleAccountStatus = async (a: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    const isInactive = a.status === 'inactive';
    
    // Nếu mở khóa tài khoản, cần kiểm tra giới hạn gói
    if (isInactive && currentUser?.role !== 'super_admin') {
      const maxUsers = currentUser?.shop?.plans?.max_users || 1;
      const activeAccountsCount = accounts.filter(ac => ac.status !== 'inactive').length;
      if (activeAccountsCount >= maxUsers) {
        return alert(`Gói hiện tại của bạn chỉ cho phép tối đa ${maxUsers} tài khoản đăng nhập hoạt động. Vui lòng nâng cấp gói để mở khóa tài khoản này.`);
      }
    }

    const action = isInactive ? 'Mở khóa' : 'Khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${action.toLowerCase()} tài khoản này?`)) return;
    
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ status: isInactive ? 'active' : 'inactive' }).eq('id', a.id);
    if (!error) fetchData();
    else alert(`Lỗi: ` + error.message);
    setLoading(false);
  };

  const handleHardDeleteAccount = async (a: any) => {
    if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'shop_admin') return alert('Chỉ chủ cửa hàng mới có quyền xóa tài khoản.');
    if (!window.confirm(`XÓA VĨNH VIỄN tài khoản đăng nhập "${a.username}"?\n\nHành động này sẽ giải phóng tên đăng nhập để bạn có thể tạo lại. Không thể hoàn tác!`)) return;
    
    setLoading(true);
    const { error } = await supabase.rpc('delete_auth_user', { target_user_id: a.id });
    if (!error) {
       fetchData();
    } else {
       alert('Lỗi xóa tài khoản (hãy chắc chắn bạn đã chạy SQL add_delete_auth_user.sql): ' + error.message);
    }
    setLoading(false);
  };

  // --- MODAL CONTROLS ---
  const openStaffEdit = (s?: any) => {
    if (s) {
      setEditingStaffId(s.id);
      setStaffFormData({ full_name: s.full_name, phone: s.phone || '', position: s.position || 'technician', status: s.status });
    } else {
      setEditingStaffId(null);
      setStaffFormData({ full_name: '', phone: '', position: 'technician', status: 'active' });
    }
    setIsStaffModalOpen(true);
  };

  const openAccountEdit = (a?: any) => {
    if (a) {
      setEditingAccountId(a.id);
      setAccountFormData({
        username: a.username || '',
        password: '',
        role: a.role || 'staff',
        permissions: a.user_permissions || [],
        staff_id: a.staff_id || ''
      });
    } else {
      setEditingAccountId(null);
      setAccountFormData({ username: '', password: '', role: 'staff', permissions: PRESETS['staff'], staff_id: '' });
    }
    setIsAccountModalOpen(true);
  };

  const closeStaffModal = () => { setIsStaffModalOpen(false); setEditingStaffId(null); };
  const closeAccountModal = () => { setIsAccountModalOpen(false); setEditingAccountId(null); };

  // --- FILTERING ---
  const filteredStaff = staff
    .filter(s => (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (a.status === 'active' && b.status === 'inactive') return -1;
      if (a.status === 'inactive' && b.status === 'active') return 1;
      return 0;
    });
  
  // Tab account: Lọc theo từ khóa (hiển thị cả tài khoản đang bị khóa)
  const filteredAccounts = accounts.filter(a => 
    ((a.username || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
     (a.staffs?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Lọc staff chưa có account (cho dropdown)
  const availableStaffsForAccount = staff.filter(s => {
    if (s.status === 'inactive') return false;
    const isAssigned = accounts.some(a => a.staff_id === s.id && a.id !== editingAccountId);
    return !isAssigned;
  });

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Nhân sự & Tài khoản</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Quản lý nhân viên (hoa hồng) và tài khoản (đăng nhập)</p>
        </div>
        
        {activeTab === 'staffs' && (
          <button onClick={() => openStaffEdit()} className="btn btn-primary" disabled={isRestricted()}>
            <UserPlus size={18} /> Thêm nhân sự Spa
          </button>
        )}
        {activeTab === 'accounts' && (
          <button onClick={() => openAccountEdit()} className="btn btn-primary" disabled={isRestricted()}>
            <ShieldCheck size={18} /> Tạo tài khoản mới
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setActiveTab('staffs')} className="btn" style={{ background: activeTab === 'staffs' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'staffs' ? 'white' : 'inherit' }}>
          <Users size={18} /> Nhân sự Spa (KTV, Lễ tân)
        </button>
        <button onClick={() => setActiveTab('accounts')} className="btn" style={{ background: activeTab === 'accounts' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'accounts' ? 'white' : 'inherit' }}>
          <KeyRound size={18} /> Tài khoản Đăng nhập
        </button>
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Tìm kiếm..." 
            style={{ paddingLeft: '2.75rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" size={32} /></div>
      ) : activeTab === 'staffs' ? (
        <div className="premium-card">
          <div className="hidden-mobile table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem' }}>Họ và tên</th>
                  <th>SĐT</th>
                  <th>Vị trí</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem', opacity: s.status === 'inactive' ? 0.6 : 1 }}>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>{s.full_name}</td>
                    <td>{s.phone || '---'}</td>
                    <td>
                      <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)' }}>
                        <Briefcase size={12} style={{ display: 'inline', marginRight: '4px' }}/>
                        {s.position === 'technician' ? 'KTV' : s.position === 'receptionist' ? 'Lễ tân' : s.position === 'manager' ? 'Quản lý' : s.position === 'collaborator' ? 'Cộng tác viên' : s.position === 'staff' ? 'KTV' : (s.position || 'KTV')}
                      </span>
                    </td>
                    <td>
                      {s.status === 'inactive' ? (
                        <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-light)', border: '1px solid var(--border)' }}>Nghỉ làm</span>
                      ) : (
                        <span className="badge badge-success">Đang làm</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => openStaffEdit(s)} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}>Sửa</button>
                        <button onClick={() => handleToggleStaffStatus(s)} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'transparent', color: s.status === 'inactive' ? 'var(--success)' : 'var(--text-light)', border: '1px solid var(--border)' }}>
                          {s.status === 'inactive' ? 'Khôi phục' : 'Cho nghỉ'}
                        </button>
                        {currentUser?.role === 'super_admin' && (
                          <button onClick={() => handleHardDeleteStaff(s.id)} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--danger)' }}><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có nhân sự nào</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="visible-mobile flex flex-col" style={{ gap: '1rem' }}>
            {filteredStaff.map((s) => (
              <div key={s.id} className="report-card" style={{ opacity: s.status === 'inactive' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{s.full_name}</div>
                  {s.status === 'inactive' ? (
                    <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-light)', border: '1px solid var(--border)' }}>Nghỉ làm</span>
                  ) : (
                    <span className="badge badge-success">Đang làm</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                  <span>{s.phone || '---'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Vị trí:</span>
                  <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)' }}>
                    {s.position === 'technician' ? 'KTV' : s.position === 'receptionist' ? 'Lễ tân' : s.position === 'manager' ? 'Quản lý' : s.position === 'collaborator' ? 'CTV' : s.position === 'staff' ? 'KTV' : (s.position || 'KTV')}
                  </span>
                </div>
                <div style={{ borderTop: '1px dashed var(--border)', margin: '0.5rem 0' }}></div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button onClick={() => openStaffEdit(s)} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}>Sửa</button>
                  <button onClick={() => handleToggleStaffStatus(s)} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'transparent', color: s.status === 'inactive' ? 'var(--success)' : 'var(--text-light)', border: '1px solid var(--border)' }}>
                    {s.status === 'inactive' ? 'Khôi phục' : 'Cho nghỉ'}
                  </button>
                  {currentUser?.role === 'super_admin' && (
                    <button onClick={() => handleHardDeleteStaff(s.id)} className="btn" style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            ))}
            {filteredStaff.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có nhân sự nào</div>
            )}
          </div>
        </div>
      ) : (
        <div className="premium-card">
          <div className="hidden-mobile table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem' }}>Tên đăng nhập (Username)</th>
                  <th>Nhân sự liên kết</th>
                  <th>Vai trò</th>
                  <th>Phân quyền</th>
                  <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem', borderLeft: a.role === 'shop_admin' ? '3px solid var(--secondary)' : '3px solid transparent', opacity: a.status === 'inactive' ? 0.6 : 1 }}>
                    <td style={{ padding: '1rem', fontWeight: '700', color: 'var(--primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <KeyRound size={16} />
                        <span style={{ textDecoration: a.status === 'inactive' ? 'line-through' : 'none' }}>{a.username}</span>
                        {a.status === 'inactive' && <span className="badge" style={{ background: 'var(--danger)', color: 'white', fontSize: '0.65rem', padding: '0.2rem 0.4rem' }}>Đã khóa</span>}
                      </div>
                    </td>
                    <td>
                      {a.staffs ? (
                        <span style={{ fontWeight: '600' }}>{a.staffs.full_name} <span style={{ color: 'var(--text-light)', fontWeight: 'normal', fontSize: '0.75rem' }}>({a.staffs.position === 'technician' ? 'KTV' : a.staffs.position === 'receptionist' ? 'Lễ tân' : a.staffs.position === 'manager' ? 'Quản lý' : a.staffs.position === 'collaborator' ? 'CTV' : a.staffs.position === 'staff' ? 'KTV' : (a.staffs.position || 'KTV')})</span></span>
                      ) : (
                        <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Không liên kết (Admin)</span>
                      )}
                    </td>
                    <td>
                      {a.role === 'shop_admin' ? (
                        <span className="badge" style={{ background: 'var(--secondary)', color: 'white' }}>Chủ cửa hàng</span>
                      ) : a.role === 'manager' ? (
                        <span className="badge" style={{ background: 'var(--primary-light)', color: 'white' }}>Quản lý</span>
                      ) : (
                        <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)' }}>Nhân viên</span>
                      )}
                    </td>
                    <td>
                      {a.role === 'shop_admin' ? (
                        <span style={{ color: 'var(--success)' }}>Toàn quyền</span>
                      ) : (
                        <span>{a.user_permissions?.length || 0} quyền chi tiết</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => openAccountEdit(a)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>Sửa Quyền</button>
                        {a.role !== 'shop_admin' && (
                          <>
                            <button onClick={() => handleToggleAccountStatus(a)} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'transparent', color: a.status === 'inactive' ? 'var(--success)' : 'var(--danger)', border: `1px solid ${a.status === 'inactive' ? 'var(--success)' : 'var(--danger)'}` }}>
                              <Lock size={14} style={{ marginRight: '4px' }} /> {a.status === 'inactive' ? 'Mở khóa' : 'Khóa'}
                            </button>
                            <button onClick={() => handleHardDeleteAccount(a)} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--danger)' }} title="Xóa vĩnh viễn">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAccounts.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có tài khoản nào</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="visible-mobile flex flex-col" style={{ gap: '1rem' }}>
            {filteredAccounts.map((a) => (
              <div key={a.id} className="report-card" style={{ opacity: a.status === 'inactive' ? 0.6 : 1, borderLeft: a.role === 'shop_admin' ? '3px solid var(--secondary)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: 'var(--primary)', fontSize: '1.1rem' }}>
                    <KeyRound size={16} />
                    <span style={{ textDecoration: a.status === 'inactive' ? 'line-through' : 'none' }}>{a.username}</span>
                  </div>
                  {a.status === 'inactive' ? (
                    <span className="badge" style={{ background: 'var(--danger)', color: 'white' }}>Đã khóa</span>
                  ) : a.role === 'shop_admin' ? (
                    <span className="badge" style={{ background: 'var(--secondary)', color: 'white' }}>Chủ cửa hàng</span>
                  ) : a.role === 'manager' ? (
                    <span className="badge" style={{ background: 'var(--primary-light)', color: 'white' }}>Quản lý</span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)' }}>Nhân viên</span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Nhân sự:</span>
                  {a.staffs ? (
                    <span style={{ fontWeight: '600' }}>{a.staffs.full_name} <span style={{ color: 'var(--text-light)', fontWeight: 'normal' }}>({a.staffs.position === 'technician' ? 'KTV' : a.staffs.position === 'receptionist' ? 'Lễ tân' : a.staffs.position === 'manager' ? 'Quản lý' : a.staffs.position === 'collaborator' ? 'CTV' : a.staffs.position === 'staff' ? 'KTV' : (a.staffs.position || 'KTV')})</span></span>
                  ) : (
                    <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Không liên kết (Admin)</span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Phân quyền:</span>
                  {a.role === 'shop_admin' ? (
                    <span style={{ color: 'var(--success)' }}>Toàn quyền</span>
                  ) : (
                    <span>{a.user_permissions?.length || 0} quyền chi tiết</span>
                  )}
                </div>

                <div style={{ borderTop: '1px dashed var(--border)', margin: '0.5rem 0' }}></div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button onClick={() => openAccountEdit(a)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Sửa Quyền</button>
                  {a.role !== 'shop_admin' && (
                    <>
                      <button onClick={() => handleToggleAccountStatus(a)} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'transparent', color: a.status === 'inactive' ? 'var(--success)' : 'var(--danger)', border: `1px solid ${a.status === 'inactive' ? 'var(--success)' : 'var(--danger)'}` }}>
                        <Lock size={14} style={{ marginRight: '4px' }} /> {a.status === 'inactive' ? 'Mở khóa' : 'Khóa'}
                      </button>
                      <button onClick={() => handleHardDeleteAccount(a)} className="btn" style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }} title="Xóa vĩnh viễn">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredAccounts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Không có tài khoản nào</div>
            )}
          </div>
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
              <h3 style={{ margin: 0 }}>Cấu hình Tài khoản Đăng nhập</h3>
              <button type="button" onClick={closeAccountModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSaveAccount}>
              <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '2rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Tên đăng nhập (Username)</label>
                  <input type="text" className="form-input" required value={accountFormData.username} onChange={(e) => setAccountFormData({...accountFormData, username: e.target.value})} placeholder="VD: ngoc.letan" disabled={!!editingAccountId} style={{ background: editingAccountId ? 'var(--bg-main)' : 'white' }} autoComplete="off" />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Mật khẩu (Để trống nếu giữ nguyên)</label>
                  <input type="password" className="form-input" value={accountFormData.password} onChange={(e) => setAccountFormData({...accountFormData, password: e.target.value})} placeholder="******" autoComplete="new-password" />
                </div>
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem', color: 'var(--primary)' }}>Liên kết với Nhân sự Spa (1 staff ↔ 1 account)</label>
                  <select className="form-select" required value={accountFormData.staff_id} onChange={(e) => setAccountFormData({...accountFormData, staff_id: e.target.value})}>
                    <option value="">-- Bắt buộc chọn nhân sự --</option>
                    {availableStaffsForAccount.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.position === 'technician' ? 'KTV' : s.position === 'receptionist' ? 'Lễ tân' : s.position === 'manager' ? 'Quản lý' : s.position === 'collaborator' ? 'CTV' : s.position === 'staff' ? 'KTV' : (s.position || 'KTV')})</option>
                    ))}
                    {editingAccountId && accountFormData.staff_id && !availableStaffsForAccount.some(s => s.id === accountFormData.staff_id) && (
                       // Hiển thị lại staff hiện tại đang được gán nếu có
                       <option value={accountFormData.staff_id}>{staff.find(s => s.id === accountFormData.staff_id)?.full_name} (Đang liên kết)</option>
                    )}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Vai trò mặc định</label>
                  <select className="form-select" value={accountFormData.role} onChange={handleRoleChange}>
                    <option value="staff">Nhân viên thông thường (Lễ tân)</option>
                    <option value="manager">Quản lý cấp trung</option>
                  </select>
                </div>
              </div>

              {accountFormData.role !== 'shop_admin' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={18} color="var(--primary)" /> Cấp quyền chi tiết
                  </h4>
                  <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    {['Bán hàng', 'Khách hàng', 'Giường & Điều phối', 'Báo cáo', 'Nhân sự', 'Cài đặt'].map(group => (
                      <div key={group} style={{ gridColumn: (group === 'Báo cáo' || group === 'Bán hàng') ? '1 / 3' : 'auto' }}>
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
                <button type="submit" className="btn btn-primary" disabled={saving || !accountFormData.staff_id}>
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
