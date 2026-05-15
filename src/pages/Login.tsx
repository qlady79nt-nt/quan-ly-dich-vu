import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, Lock, User, Building2, Loader2, Scissors } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [shopCode, setShopCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Logic: Ghép shop_code + username thành email ảo
      // Ví dụ: lan@abc123.spa.local
      // Nếu là Super Admin (không có shop code), dùng email thật hoặc quy ước riêng
      let email = `${username.toLowerCase()}@${shopCode.toLowerCase()}.spa.local`;
      
      // Trường hợp đăng nhập Super Admin (có thể nhập trực tiếp email hoặc username đặc biệt)
      if (!shopCode && username.includes('@')) {
        email = username;
      }

      const { data: authData, error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (loginErr) throw loginErr;

      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', authData.user.id)
          .single();

        if (profile?.status === 'inactive') {
          await supabase.auth.signOut();
          throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản lý.');
        }
      }

      navigate('/app/dashboard');
    } catch (err: any) {
      setError(err.message || 'Thông tin đăng nhập không chính xác. Vui lòng kiểm tra lại Shop Code hoặc Username.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
      <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '64px', height: '64px', background: 'var(--primary)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 1.5rem' }}>
            <Scissors size={32} />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Đăng nhập</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Chào mừng bạn đến với hệ thống Spa & Salon</p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
            <Shield size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="form-label">Mã cửa hàng (Shop Code)</label>
            <div style={{ position: 'relative' }}>
              <Building2 size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="ABC123" 
                style={{ paddingLeft: '2.75rem' }}
                value={shopCode}
                onChange={(e) => setShopCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Tên đăng nhập (Username)</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="lan.tran" 
                required
                style={{ paddingLeft: '2.75rem' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                required
                style={{ paddingLeft: '2.75rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '50px', fontSize: '1rem', marginTop: '1rem' }} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Đăng nhập ngay'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-light)' }}>
          <p style={{ marginBottom: '0.5rem' }}>Quên mật khẩu? Vui lòng liên hệ Quản lý.</p>
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            Bạn là chủ cửa hàng mới? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>Đăng ký dùng thử miễn phí</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
