import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Login = () => {
  const navigate = useNavigate();
  // tabs: 'staff', 'owner_login', 'owner_register'
  const [tab, setTab] = useState<'staff' | 'owner_login' | 'owner_register'>('staff');
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shopCode, setShopCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (tab === 'staff') {
        // --- LUỒNG NHÂN VIÊN ---
        if (!shopCode || !username || !password) throw new Error('Vui lòng nhập đầy đủ thông tin');
        const fakeEmail = `${username.toLowerCase().trim()}@${shopCode.toLowerCase().trim()}.spa.local`;
        
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password,
        });

        if (authError) {
          if (authError.message.includes('Invalid login credentials')) {
            throw new Error('Sai tài khoản hoặc mật khẩu (Hoặc sai Mã Shop).');
          }
          throw authError;
        }

        // Kiểm tra role và chuyển trang
        checkRoleAndRedirect(authData.user.id);

      } else if (tab === 'owner_login') {
        // --- LUỒNG CHỦ TIỆM ĐĂNG NHẬP ---
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;
        checkRoleAndRedirect(authData.user.id);

      } else if (tab === 'owner_register') {
        // --- LUỒNG CHỦ TIỆM ĐĂNG KÝ (CLAIM SHOP) ---
        if (!shopCode) throw new Error('Vui lòng nhập Mã Shop do Super Admin cung cấp.');

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        // Gọi hàm RPC để nhận chủ quyền Shop
        const { error: rpcError } = await supabase.rpc('claim_shop', { 
          p_shop_code: shopCode 
        });

        if (rpcError) {
          throw new Error('Mã Shop không hợp lệ hoặc đã được sử dụng!');
        }

        setSuccessMsg('Đăng ký mở tiệm thành công! Đang chuyển hướng...');
        setTimeout(() => navigate('/admin/shop'), 2000);
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Đã có lỗi xảy ra. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  const checkRoleAndRedirect = async (userId: string) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    if (profile?.status === 'inactive') {
      await supabase.auth.signOut();
      throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ chủ tiệm.');
    }

    const role = profile?.role || 'staff';

    if (role === 'super_admin') navigate('/superadmin/dashboard');
    else if (role === 'shop_admin') navigate('/admin/shop');
    else navigate('/pos/monitor');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-color) 100%)' }}>
      <div className="premium-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(123, 31, 162, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={32} color="var(--primary-color)" />
          </div>
        </div>
        
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Hệ thống SaaS Spa & Clinic</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Đăng nhập vào không gian quản lý</p>

        {/* TAB TOGGLE */}
        <div style={{ display: 'flex', backgroundColor: 'var(--background-light)', borderRadius: '0.5rem', padding: '0.25rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => { setTab('staff'); setErrorMsg(''); }}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '0.25rem', border: 'none', background: tab === 'staff' ? 'white' : 'transparent', fontWeight: tab === 'staff' ? 600 : 400, boxShadow: tab === 'staff' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
          >
            Nhân viên
          </button>
          <button 
            onClick={() => { setTab('owner_login'); setErrorMsg(''); }}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '0.25rem', border: 'none', background: tab !== 'staff' ? 'white' : 'transparent', fontWeight: tab !== 'staff' ? 600 : 400, boxShadow: tab !== 'staff' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
          >
            Chủ tiệm
          </button>
        </div>
        
        {errorMsg && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {tab === 'staff' ? (
            // --- FORM NHÂN VIÊN ---
            <>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Mã Cửa Hàng (Shop Code)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ví dụ: XY892" 
                  value={shopCode}
                  onChange={e => setShopCode(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Tên đăng nhập</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ví dụ: lan, hoa..." 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
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
            </>
          ) : (
            // --- FORM CHỦ TIỆM ---
            <>
              {tab === 'owner_register' && (
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Mã Shop (Do Super Admin cấp)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ví dụ: XY892" 
                    value={shopCode}
                    onChange={e => setShopCode(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Email Quản trị viên</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="admin@spa.com" 
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
              
              <div style={{ textAlign: 'right', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {tab === 'owner_login' ? (
                  <button type="button" onClick={() => setTab('owner_register')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: 0 }}>
                    Lần đầu đăng nhập? Mở tiệm ngay
                  </button>
                ) : (
                  <button type="button" onClick={() => setTab('owner_login')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: 0 }}>
                    Đã có tài khoản? Đăng nhập
                  </button>
                )}
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: tab === 'owner_register' ? 'var(--success-color)' : 'var(--primary-color)' }}>
            {loading ? <Loader2 size={20} className="animate-spin" /> : (tab === 'owner_register' ? <UserPlus size={20} /> : <LogIn size={20} />)}
            {loading ? 'Đang xử lý...' : (tab === 'owner_register' ? 'Mở Tiệm Ngay' : 'Đăng nhập')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
