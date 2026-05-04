import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('admin');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'superadmin') {
      navigate('/superadmin/dashboard');
    } else if (role === 'admin') {
      navigate('/admin/shop');
    } else {
      navigate('/pos/monitor');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-color) 100%)' }}>
      <div className="premium-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(123, 31, 162, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={32} color="var(--primary-color)" />
          </div>
        </div>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Hệ thống Spa & Clinic</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Vui lòng đăng nhập để tiếp tục</p>
        
        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Tài khoản</label>
            <input type="text" className="form-input" placeholder="admin@spa.com" defaultValue="admin@spa.com" />
          </div>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Mật khẩu</label>
            <input type="password" className="form-input" placeholder="••••••••" defaultValue="password" />
          </div>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Đăng nhập với vai trò</label>
            <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
              <option value="superadmin">Super Admin (Chủ hệ thống SaaS)</option>
              <option value="admin">Quản lý Shop (Shop Admin)</option>
              <option value="staff">Nhân viên / POS</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Đăng nhập hệ thống
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
