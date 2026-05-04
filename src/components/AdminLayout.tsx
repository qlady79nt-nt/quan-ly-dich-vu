import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Store, Users, LayoutDashboard, Settings, Bed, Package } from 'lucide-react';

const AdminLayout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/admin/shop', label: 'Cửa hàng', icon: Store },
    { path: '/admin/users', label: 'Nhân viên & Quyền', icon: Users },
    { path: '/admin/resources', label: 'Giường & Phòng', icon: Bed },
    { path: '/admin/services', label: 'Dịch vụ & Liệu trình', icon: Package },
  ];

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Settings className="text-primary" />
          <span>Admin Setup</span>
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
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <Link to="/pos/monitor" className="btn-secondary" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
            Chuyển sang POS
          </Link>
        </div>
      </aside>
      
      <main className="main-content">
        <header className="topbar">
          <h2 style={{ fontSize: '1.25rem' }}>Hệ thống Quản lý Dịch vụ</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              A
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>Admin User</div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>Quản trị viên</div>
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
