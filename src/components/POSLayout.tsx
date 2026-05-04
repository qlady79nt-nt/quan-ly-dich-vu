import { Outlet, Link, useLocation } from 'react-router-dom';
import { MonitorPlay, FileText, CalendarClock, PackageOpen, LogOut } from 'lucide-react';

const POSLayout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/pos/invoice', label: 'Tạo hoá đơn mới', icon: FileText },
    { path: '/pos/packages', label: 'Bán & Dùng Liệu trình', icon: PackageOpen },
    { path: '/pos/monitor', label: 'Màn hình Giường (Live)', icon: MonitorPlay },
  ];

  return (
    <div className="layout-container">
      <aside className="sidebar" style={{ width: '220px', backgroundColor: '#1e1e2d', color: 'white', borderRight: 'none' }}>
        <div className="sidebar-header" style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <CalendarClock color="var(--secondary-color)" />
          <span style={{ color: 'var(--secondary-color)' }}>POS System</span>
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
                  backgroundColor: isActive ? 'rgba(0, 191, 165, 0.1)' : 'transparent',
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
        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link to="/admin/shop" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem' }}>
            ← Về Admin
          </Link>
          <Link to="/login" style={{ color: 'var(--danger-color)', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogOut size={16} /> Đăng xuất
          </Link>
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
