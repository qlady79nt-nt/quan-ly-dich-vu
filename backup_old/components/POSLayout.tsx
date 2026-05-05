import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { MonitorPlay, FileText, CalendarClock, PackageOpen, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../lib/auth';

const POSLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const navItems = [
    { path: '/pos/invoice', label: 'Tạo hoá đơn mới', icon: FileText },
    { path: '/pos/packages', label: 'Bán & Dùng Liệu trình', icon: PackageOpen },
    { path: '/pos/monitor', label: 'Màn hình Trạng thái (Live)', icon: MonitorPlay },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    : 'PO';

  return (
    <div className="layout-container">
      <aside className="sidebar" style={{ width: '220px', backgroundColor: '#1e1e2d', color: 'white', borderRight: 'none' }}>
        <div className="sidebar-header" style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <CalendarClock color="var(--secondary-color)" />
          <span style={{ color: 'var(--secondary-color)' }}>POS System</span>
        </div>

        {/* User info */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary-color), #a0826d)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.875rem', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'white' }}>{profile?.full_name || 'Nhân viên'}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{profile?.role === 'staff' ? 'Kỹ thuật viên' : 'Quản lý'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', gap: '0.75rem',
                  color: isActive ? 'white' : '#9ca3af',
                  backgroundColor: isActive ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                  borderLeft: isActive ? '4px solid var(--secondary-color)' : '4px solid transparent',
                  textDecoration: 'none',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={20} color={isActive ? 'var(--secondary-color)' : '#9ca3af'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(profile?.role === 'shop_admin' || profile?.role === 'manager') && (
            <Link to="/admin/shop" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={16} /> Về Admin Panel
            </Link>
          )}
          <button onClick={handleLogout} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="main-content" style={{ backgroundColor: '#f8fafc' }}>
        <div className="content-area" style={{ padding: '2rem' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default POSLayout;
