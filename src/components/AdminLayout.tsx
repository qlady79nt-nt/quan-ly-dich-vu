import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Store, Users, Bed, Package, Target, LogOut, Settings, Monitor } from 'lucide-react';
import { useAuth } from '../lib/auth';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const navItems = [
    { path: '/admin/shop', label: 'Cửa hàng', icon: Store },
    { path: '/admin/users', label: 'Nhân viên & Quyền', icon: Users },
    { path: '/admin/resources', label: 'Không gian dịch vụ', icon: Bed },
    { path: '/admin/services', label: 'Dịch vụ & Liệu trình', icon: Package },
    { path: '/admin/reports', label: 'Báo Cáo Doanh Thu', icon: Target },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    : 'AD';

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Settings className="text-primary" />
          <span className="text-gradient">Admin Setup</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Link to="/pos/monitor" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
            <Monitor size={18} /> Chuyển sang POS
          </Link>
          <button onClick={handleLogout} className="btn-danger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
            <LogOut size={18} /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <h2 style={{ fontSize: '1.25rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Hệ thống Quản lý Dịch vụ</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{profile?.full_name || 'Admin'}</div>
              <div style={{ color: 'var(--primary-light)', fontSize: '0.75rem', fontWeight: '500' }}>
                {profile?.role === 'shop_admin' ? 'Quản trị viên' : profile?.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
              </div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(109, 40, 217, 0.3)' }}>
              {initials}
            </div>
          </div>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
