import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Scissors, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  LogOut,
  ChevronRight,
  UserCircle,
  Menu,
  X
} from 'lucide-react';
import { AuthProvider, useAuth, ProtectedRoute } from './lib/auth';

// --- Import Pages ---
import Dashboard from './pages/Dashboard';
import Staff from './pages/Staff';
import Services from './pages/Services';
import Packages from './pages/Packages';
import POS from './pages/POS';
import Reports from './pages/Reports';
import Login from './pages/Login';

// --- LAYOUT COMPONENT ---
const MainLayout = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { path: '/pos', label: 'Bán hàng (POS)', icon: ShoppingCart },
    { path: '/staff', label: 'Nhân viên', icon: Users },
    { path: '/services', label: 'Dịch vụ', icon: Scissors },
    { path: '/packages', label: 'Liệu trình', icon: Package },
    { path: '/reports', label: 'Báo cáo', icon: BarChart3 },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="layout-container">
      <style>{`
        .layout-container {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg-main);
        }
        .sidebar {
          width: 260px;
          background: white;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          position: fixed;
          height: 100vh;
          transition: all 0.3s ease;
          z-index: 1001;
        }
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          margin-left: 260px;
          transition: all 0.3s ease;
          min-width: 0;
        }
        .menu-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-primary);
          padding: 0.5rem;
          border-radius: 0.5rem;
        }
        .menu-toggle:hover {
          background: var(--bg-main);
        }
        .sidebar-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 1000;
        }
        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .main-content {
            margin-left: 0;
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .sidebar-overlay.open {
            display: block;
          }
          .menu-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .user-info {
            display: none !important;
          }
        }
        @media (min-width: 769px) {
          .user-info {
            display: block !important;
          }
        }
      `}</style>

      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Scissors size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="text-gradient" style={{ fontSize: '1.25rem' }}>Spa & POS</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="menu-toggle">
            <X size={20} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '0 1rem' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path);
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={() => setIsSidebarOpen(false)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  padding: '0.875rem 1rem', 
                  textDecoration: 'none', 
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(109, 40, 217, 0.05)' : 'transparent',
                  borderRadius: '0.75rem',
                  marginBottom: '0.25rem',
                  fontWeight: isActive ? '600' : '500',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '2rem', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSignOut} className="btn" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger)', background: 'transparent' }}>
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header style={{ height: '70px', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setIsSidebarOpen(true)} className="menu-toggle">
              <Menu size={24} />
            </button>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Trang chủ <ChevronRight size={14} /> {menuItems.find(m => location.pathname.includes(m.path))?.label || 'Dashboard'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="user-info" style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{profile?.full_name || 'Admin User'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{profile?.role || 'Shop Admin'}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <UserCircle size={24} />
            </div>
          </div>
        </header>

        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', width: '100%' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="staff" element={<Staff />} />
            <Route path="services" element={<Services />} />
            <Route path="packages" element={<Packages />} />
            <Route path="pos" element={<POS />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
