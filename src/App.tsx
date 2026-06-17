import { useState } from 'react';
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
  FileText,
  Menu,
  X,
  MoreHorizontal,
  Coins,
  Settings2
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
import ShopAdmins from './pages/ShopAdmins';
import Beds from './pages/Beds';
import Customers from './pages/Customers';
import Register from './pages/Register';
import Landing from './pages/Landing';
import AuditLogs from './pages/AuditLogs';
import StaffIncome from './pages/StaffIncome';
import PrintSettings from './pages/PrintSettings';

// --- LAYOUT COMPONENT ---
const MainLayout = () => {
  const { profile, signOut, shopStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  let menuItems = [];

  if (profile?.role === 'super_admin') {
    menuItems = [
      { path: '/app/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { path: '/app/shops', label: 'Quản lý Cửa hàng', icon: LayoutGrid },
      { path: '/app/shop-admins', label: 'Quản lý Shop Admin', icon: Users },
      { path: '/app/audit-logs', label: 'Nhật ký Hệ thống', icon: ShieldAlert },
      { path: '/app/print-settings', label: 'Cài đặt máy in', icon: Settings2 }
    ];
  } else {
    menuItems = [
      ...(profile?.role === 'shop_admin' ? [{ path: '/app/dashboard', label: 'Tổng quan', icon: LayoutDashboard }] : []),
      { path: '/app/pos', label: 'Bán hàng (POS)', icon: ShoppingCart },
      { path: '/app/beds', label: 'Quản lý Chỗ', icon: LayoutGrid },
      ...(profile?.role === 'shop_admin' ? [{ path: '/app/staff', label: 'Nhân viên', icon: Users }] : []),
      { path: '/app/services', label: 'Dịch vụ', icon: Scissors },
      ...(profile?.role === 'shop_admin' ? [{ path: '/app/customers', label: 'Khách hàng', icon: UserCircle }] : []),
      ...(profile?.role === 'shop_admin' ? [{ path: '/app/packages', label: 'Liệu trình', icon: Package }] : []),
      { path: '/app/invoices', label: 'Hoá đơn', icon: FileText },
      { path: '/app/staff-income', label: 'Thu nhập KTV', icon: Coins },
      { path: '/app/reports', label: 'Báo cáo', icon: BarChart3 },
      ...(profile?.role === 'shop_admin' ? [{ path: '/app/print-settings', label: 'Cài đặt máy in', icon: Settings2 }] : []),
    ];
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      ></div>

      {/* Sidebar */}
      <aside className={`app-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem', position: 'relative' }}>
          <button 
            className="mobile-menu-btn" 
            style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.25rem' }}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '1.25rem' }}>
              {profile?.role === 'super_admin' ? 'SA' : (profile?.shop?.name?.charAt(0)?.toUpperCase() || 'S')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px', lineHeight: '1.2' }}>
                {profile?.role === 'super_admin' ? 'Super Admin' : (profile?.shop?.name || 'SPA Manager')}
              </span>
              {profile?.role !== 'super_admin' && (
                <>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '2px' }}>
                    {profile?.full_name || 'Quản trị viên'} ({profile?.username || 'admin'})
                  </span>
                  {profile?.shop?.shop_code && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700', marginTop: '2px' }}>
                      ID: {profile?.shop?.shop_code}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 1rem' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path);
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={() => setIsMobileMenuOpen(false)}
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
      <main className="app-main">
        <header style={{ height: '70px', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <button 
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              style={{ padding: '0.5rem', background: 'transparent', border: 'none', flexShrink: 0 }}
            >
              <Menu size={24} />
            </button>
            <span className="desktop-only" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Trang chủ <ChevronRight size={14} style={{ flexShrink: 0 }} /> {menuItems.find(m => location.pathname.includes(m.path))?.label || 'Dashboard'}
            </span>
            <span className="mobile-only" style={{ fontSize: '1.25rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {menuItems.find(m => location.pathname.includes(m.path))?.label || 'Dashboard'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <div className="desktop-only" style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{profile?.full_name || 'Quản trị viên'} <span style={{fontWeight: '400', color: 'var(--text-light)'}}>({profile?.username || 'admin'})</span></div>
              <div style={{ fontSize: '0.75rem', color: profile?.role === 'super_admin' ? 'var(--secondary)' : 'var(--text-light)', fontWeight: profile?.role === 'super_admin' ? '700' : '500' }}>
                {profile?.role === 'super_admin' ? 'Hệ thống' : (profile?.shop?.name || 'Cửa hàng')}
              </div>
            </div>
            <div className="desktop-only" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <UserCircle size={24} />
            </div>
            <button 
              onClick={handleSignOut} 
              className="mobile-only" 
              style={{ 
                background: 'var(--danger)', 
                border: 'none', 
                color: 'white', 
                padding: '0.4rem 0.75rem', 
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              Thoát
            </button>
          </div>
        </header>

        <div className="page-container" style={{ flex: 1, overflowY: 'auto' }}>
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

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <Link to="/app/dashboard" className={`mobile-nav-item ${location.pathname.includes('/dashboard') ? 'active' : ''}`}>
          <LayoutDashboard size={24} />
          <span>Tổng quan</span>
        </Link>
        <Link to="/app/invoices" className={`mobile-nav-item ${location.pathname.includes('/invoices') ? 'active' : ''}`}>
          <FileText size={24} />
          <span>Hóa đơn</span>
        </Link>
        <Link to="/app/pos" className={`mobile-nav-item ${location.pathname.includes('/pos') ? 'active' : ''}`}>
          <ShoppingCart size={24} />
          <span>Bán hàng</span>
        </Link>
        <Link to="/app/customers" className={`mobile-nav-item ${location.pathname.includes('/customers') ? 'active' : ''}`}>
          <UserCircle size={24} />
          <span>Khách hàng</span>
        </Link>
        <button onClick={() => setIsMobileMenuOpen(true)} className="mobile-nav-item" style={{ background: 'transparent', border: 'none' }}>
          <MoreHorizontal size={24} />
          <span>Menu</span>
        </button>
        <button onClick={handleSignOut} className="mobile-nav-item" style={{ background: 'transparent', border: 'none', color: 'var(--danger)' }}>
          <LogOut size={24} />
          <span>Thoát</span>
        </button>
      </nav>
    </div>
  );
};

const IndexRedirect = () => {
  const { profile } = useAuth();
  if (profile?.role === 'shop_admin' || profile?.role === 'super_admin') {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <Navigate to="/app/pos" replace />;
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
            <Route index element={<IndexRedirect />} />
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['super_admin', 'shop_admin']}><Dashboard /></ProtectedRoute>} />
            <Route path="staff" element={<Staff />} />
            <Route path="services" element={<Services />} />
            <Route path="beds" element={<Beds />} />
            <Route path="customers" element={<Customers />} />
            <Route path="packages" element={<Packages />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="pos" element={<POS />} />
            <Route path="reports" element={<Reports />} />
            <Route path="staff-income" element={<StaffIncome />} />
            <Route path="shops" element={<ProtectedRoute allowedRoles={['super_admin']}><Shops /></ProtectedRoute>} />
            <Route path="shop-admins" element={<ProtectedRoute allowedRoles={['super_admin']}><ShopAdmins /></ProtectedRoute>} />
            <Route path="audit-logs" element={<ProtectedRoute allowedRoles={['super_admin']}><AuditLogs /></ProtectedRoute>} />
            <Route path="print-settings" element={<ProtectedRoute allowedRoles={['super_admin', 'shop_admin']}><PrintSettings /></ProtectedRoute>} />
          </Route>
          {/* Redirect old dashboard path if needed */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
