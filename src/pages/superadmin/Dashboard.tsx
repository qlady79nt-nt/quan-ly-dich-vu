import { Store, Plus, ShieldAlert } from 'lucide-react';

const SuperAdminDashboard = () => {
  return (
    <div className="grid-cols-2">
      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Store size={24} />
          Tạo Shop Mới (Onboarding)
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Cấp phát không gian riêng (Tenant) cho một khách hàng mới. Toàn bộ dữ liệu của họ sẽ bị cô lập bởi RLS.
        </p>
        
        <div className="form-group">
          <label className="form-label">Tên cửa hàng (Shop Name)</label>
          <input type="text" className="form-input" placeholder="Ví dụ: Thẩm Mỹ Viện XYZ" />
        </div>
        
        <div className="grid-cols-2" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Email Shop Admin (Chủ tiệm)</label>
            <input type="email" className="form-input" placeholder="admin@xyz.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Mật khẩu khởi tạo</label>
            <input type="password" className="form-input" placeholder="••••••••" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Gán Gói Dịch Vụ (Subscription Plan)</label>
          <select className="form-select">
            <option>Gói Dùng Thử (Free) - Tối đa 1 User, 5 Giường</option>
            <option>Gói Chuyên Nghiệp (Pro) - 999.000đ/Tháng</option>
            <option>Gói Nâng Cao (Premium) - Realtime + Báo cáo nâng cao</option>
          </select>
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--success-color)', boxShadow: 'none' }}>
          <Plus size={20} />
          Khởi tạo Shop & Gửi Email thông báo
        </button>
      </div>

      <div>
        <div className="premium-card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Danh sách Shop (Tenants)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.5rem' }}>Tên Shop</th>
                <th style={{ padding: '0.5rem' }}>Gói</th>
                <th style={{ padding: '0.5rem' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>Spa Thiên Nhiên</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>Premium</td>
                <td style={{ padding: '0.75rem 0.5rem' }}><span className="badge badge-success">Active</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>Phòng Khám Da Liễu</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>Free Trial</td>
                <td style={{ padding: '0.75rem 0.5rem' }}><span className="badge badge-danger">Expired</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="premium-card" style={{ border: '1px solid var(--danger-color)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldAlert size={20} />
            Hệ thống Bảo Mật
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Cơ chế RLS (Row Level Security)</strong> đang hoạt động.<br/><br/>
            Mỗi Shop Admin (Chủ tiệm) chỉ có thể truy vấn dữ liệu (nhân viên, hoá đơn, giường) có chứa <code>shop_id</code> của họ. 
            Backend tự động block (throw Forbidden) nếu cố tình thay đổi <code>shop_id</code> trong payload API.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
