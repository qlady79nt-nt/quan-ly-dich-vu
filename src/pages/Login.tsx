import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Đăng nhập Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Lấy Role từ bảng profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
         throw profileError;
      }

      const role = profile?.role || 'staff';

      // 3. Phân luồng theo Role
      if (role === 'super_admin') {
        navigate('/superadmin/dashboard');
      } else if (role === 'shop_admin') {
        navigate('/admin/shop');
      } else {
        navigate('/pos/monitor');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email/password.');
    } finally {
      setLoading(false);
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
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Vui lòng đăng nhập bằng tài khoản Supabase</p>
        
        {errorMsg && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Email</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="Nhập email..." 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Mật khẩu</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            {loading ? <Loader2 size={20} /> : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
