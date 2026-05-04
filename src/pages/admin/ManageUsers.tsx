import { useState } from 'react';
import { Plus, Save, UserCheck, Shield } from 'lucide-react';

const ManageUsers = () => {
  const permissionsList = [
    { id: 'sale.create', label: 'Tạo đơn hàng (sale.create)' },
    { id: 'sale.discount', label: 'Giảm giá (sale.discount)' },
    { id: 'sale.edit', label: 'Sửa đơn (sale.edit)' },
    { id: 'sale.delete', label: 'Xóa đơn (sale.delete)' },
    { id: 'report.revenue.view', label: 'Xem doanh thu (report.revenue.view)' },
    { id: 'report.invoice.view', label: 'Xem hoá đơn (report.invoice.view)' },
    { id: 'report.commission.view', label: 'Xem hoa hồng (report.commission.view)' },
    { id: 'invoice.print', label: 'In hoá đơn (invoice.print)' },
  ];

  const [selectedPerms, setSelectedPerms] = useState<string[]>(['sale.create', 'invoice.print']);

  const togglePerm = (id: string) => {
    setSelectedPerms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  return (
    <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCheck size={24} />
          Thêm Nhân Viên (User)
        </h2>
        <div className="form-group">
          <label className="form-label">Họ và tên</label>
          <input type="text" className="form-input" placeholder="Nguyễn Văn A" />
        </div>
        <div className="form-group">
          <label className="form-label">Email / Tài khoản đăng nhập</label>
          <input type="email" className="form-input" placeholder="nva@spa.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Mật khẩu</label>
          <input type="password" className="form-input" placeholder="••••••••" />
        </div>
        <button className="btn-primary" style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Plus size={20} />
          Tạo tài khoản
        </button>
      </div>

      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={24} />
          Phân Quyền (Permissions)
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Tick chọn các quyền cho nhân viên đang chọn. Khi nhân viên đăng nhập, hệ thống sẽ tự động tải các quyền này.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', background: '#f9fafb', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
          {permissionsList.map((perm) => (
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
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={20} />
            Lưu quyền truy cập
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageUsers;
