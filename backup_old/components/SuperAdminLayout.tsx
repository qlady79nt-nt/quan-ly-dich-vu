import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Store, ShieldCheck, Activity, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

const SuperAdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const navItems = [
    { path: '/superadmin/dashboard', label: 'Quản lý Shop (Tenant)', icon: Store },
    { path: '/superadmin/plans', label: 'Quản lý Gói (Plans)', icon: Activity },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    : 'SA';

  return (
    <div className="layout-container">
      <aside className="sidebar" style={{ backgroundColor: '#111827', color: 'white' }}>
        <div className="sidebar-header" style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <ShieldCheck color="var(--success-color)" />
          <span style={{ color: 'var(--success-color)' }}>SUPER ADMIN</span>
        </div>

        {/* User info */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #f87171)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.875rem', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'white' }}>{profile?.full_name || 'Super Admin'}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Quản trị hệ thống</div>
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

        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={handleLogout} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: 0 }}>
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="main-content" style={{ backgroundColor: '#f3f4f6' }}>
        <header className="topbar">
          <h2 style={{ fontSize: '1.25rem' }}>Hệ thống SaaS Control Panel</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #f87171)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{profile?.full_name || 'Super Admin'}</div>
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
