import { Outlet, Link, useLocation } from 'react-router-dom';
import { Store, ShieldCheck, Activity } from 'lucide-react';

const SuperAdminLayout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/superadmin/dashboard', label: 'Quản lý Shop (Tenant)', icon: Store },
    { path: '/superadmin/plans', label: 'Quản lý Gói (Plans)', icon: Activity },
  ];

  return (
    <div className="layout-container">
      <aside className="sidebar" style={{ backgroundColor: '#111827', color: 'white' }}>
        <div className="sidebar-header" style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <ShieldCheck color="var(--success-color)" />
          <span style={{ color: 'var(--success-color)' }}>SUPER ADMIN</span>
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
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  borderLeft: isActive ? '4px solid var(--success-color)' : '4px solid transparent',
                  textDecoration: 'none',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={20} color={isActive ? 'var(--success-color)' : '#9ca3af'} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      
      <main className="main-content" style={{ backgroundColor: '#f3f4f6' }}>
        <header className="topbar">
          <h2 style={{ fontSize: '1.25rem' }}>Hệ thống SaaS Control Panel</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--danger-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              SA
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>Chủ Hệ Thống</div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>Super Admin</div>
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

export default SuperAdminLayout;
