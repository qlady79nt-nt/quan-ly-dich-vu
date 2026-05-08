import { BrowserRouter as Router, Routes, Route, Navigate, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Scissors, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  LogOut,
  ChevronRight,
  UserCircle,
  LayoutGrid,
  ShieldAlert,
  Calendar,
  LayoutDashboard,
  FileText
} from 'lucide-react';
import { AuthProvider, useAuth, ProtectedRoute } from './lib/auth';

// --- Import Pages ---
import Dashboard from './pages/Dashboard';
import Staff from './pages/Staff';
import Services from './pages/Services';
import Packages from './pages/Packages';
import Invoices from './pages/Invoices';
import POS from './pages/POS';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Shops from './pages/Shops';
import Beds from './pages/Beds';
import Customers from './pages/Customers';
import Register from './pages/Register';
import Landing from './pages/Landing';

// --- LAYOUT COMPONENT ---
const MainLayout = () => {
  const { profile, signOut, shopStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  let menuItems = [];

  if (profile?.role === 'super_admin') {
    menuItems = [
      { path: '/app/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { path: '/app/shops', label: 'Quản lý Cửa hàng', icon: LayoutGrid }
    ];
  } else {
    menuItems = [
      { path: '/app/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { path: '/app/pos', label: 'Bán hàng (POS)', icon: ShoppingCart },
      { path: '/app/beds', label: 'Quản lý Chỗ', icon: LayoutGrid },
      { path: '/app/staff', label: 'Nhân viên', icon: Users },
      { path: '/app/services', label: 'Dịch vụ', icon: Scissors },
      { path: '/app/customers', label: 'Khách hàng', icon: UserCircle },
      { path: '/app/packages', label: 'Liệu trình', icon: Package },
      { path: '/app/invoices', label: 'Hoá đơn', icon: FileText },
      { path: '/app/reports', label: 'Báo cáo', icon: BarChart3 },
    ];
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', background: 'white', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh' }}>
        <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Scissors size={24} />
          </div>
          <h1 className="text-gradient" style={{ fontSize: '1.25rem' }}>Spa & POS</h1>
        </div>

        <nav style={{ flex: 1, padding: '0 1rem' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path);
            return (
              <Link 
                key={item.path} 
                to={item.path} 
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
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '260px' }}>
        <header style={{ height: '70px', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Trang chủ <ChevronRight size={14} /> {menuItems.find(m => location.pathname.includes(m.path))?.label || 'Dashboard'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{profile?.full_name || 'Quản trị viên'}</div>
              <div style={{ fontSize: '0.75rem', color: profile?.role === 'super_admin' ? 'var(--secondary)' : 'var(--text-light)', fontWeight: profile?.role === 'super_admin' ? '700' : '400' }}>
                {profile?.role === 'super_admin' ? 'Hệ thống (Super Admin)' : (profile?.role === 'shop_admin' ? 'Chủ cửa hàng' : 'Nhân viên')}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <UserCircle size={24} />
            </div>
          </div>
        </header>

        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {shopStatus.status !== 'active' && (
            <div className="premium-card" style={{ marginBottom: '1.5rem', background: shopStatus.status === 'locked' ? '#fee2e2' : '#fef3c7', border: shopStatus.status === 'locked' ? '1px solid #ef4444' : '1px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '1rem', color: shopStatus.status === 'locked' ? '#991b1b' : '#92400e' }}>
              <ShieldAlert size={24} />
              <div>
                <div style={{ fontWeight: '700' }}>{shopStatus.status === 'locked' ? 'Tài khoản đã bị khóa' : 'Gói dịch vụ đã hết hạn'}</div>
                <div style={{ fontSize: '0.875rem' }}>{shopStatus.status === 'locked' ? 'Vui lòng liên hệ quản trị viên hệ thống để mở lại tài khoản.' : 'Vui lòng gia hạn gói dịch vụ để tiếp tục sử dụng đầy đủ các tính năng.'}</div>
              </div>
            </div>
          )}

          {shopStatus.status === 'active' && shopStatus.daysLeft !== null && shopStatus.daysLeft <= 14 && (
            <div className="premium-card" style={{ marginBottom: '1.5rem', background: '#fffbeb', border: '1px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '1rem', color: '#92400e' }}>
                <Calendar size={20} />
                <div style={{ fontSize: '0.875rem' }}>
                  ⚠️ Gói dịch vụ của bạn sẽ hết hạn sau <strong>{shopStatus.daysLeft} ngày</strong>. Vui lòng gia hạn để không bị gián đoạn hoạt động.
                </div>
            </div>
          )}

          <div className="animate-fade">
            <Outlet />
          </div>
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
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/app" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="staff" element={<Staff />} />
            <Route path="services" element={<Services />} />
            <Route path="beds" element={<Beds />} />
            <Route path="customers" element={<Customers />} />
            <Route path="packages" element={<Packages />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="pos" element={<POS />} />
            <Route path="reports" element={<Reports />} />
            <Route path="shops" element={<ProtectedRoute allowedRoles={['super_admin']}><Shops /></ProtectedRoute>} />
          </Route>
          {/* Redirect old dashboard path if needed */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
