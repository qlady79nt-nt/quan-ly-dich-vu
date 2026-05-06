import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, Lock, User, Building2, Loader2, Scissors, Sparkles, CheckCircle } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);
  
  const [shopName, setShopName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Tạo shop_code ngẫu nhiên
      const shopCode = 'SPA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const fakeEmail = `${username.toLowerCase()}@${shopCode.toLowerCase()}.spa.local`;

      // 2. Đăng ký tài khoản Auth Supabase
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: fakeEmail,
        password: password,
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Không thể tạo tài khoản xác thực.');

      // 3. Tạo dữ liệu Shop
      // Lấy plan FREE
      const { data: plan } = await supabase.from('plans').select('id').eq('name', 'FREE').single();
      
      const expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() + 30); // 30 ngày dùng thử

      const { data: shop, error: shopErr } = await supabase.from('shops').insert([{
        name: shopName,
        shop_code: shopCode,
        plan_id: plan?.id,
        expired_at: expiredAt.toISOString(),
        status: 'active'
      }]).select().single();

      if (shopErr) throw shopErr;

      // 4. Tạo Profile Admin cho Shop
      const { error: profErr } = await supabase.from('profiles').insert([{
        id: authData.user.id,
        shop_id: shop.id,
        username: username,
        full_name: 'Chủ cửa hàng',
        role: 'shop_admin',
        status: 'active'
      }]);

      if (profErr) throw profErr;

      // 5. Cấp quyền mặc định cho Admin
      await supabase.from('user_permissions').insert([
        { user_id: authData.user.id, permission: 'sale.create' },
        { user_id: authData.user.id, permission: 'sale.discount' },
        { user_id: authData.user.id, permission: 'report.view' }
      ]);

      // 6. Thành công
      setSuccessData({ shopCode, username });
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
        <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '500px', textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--success)', marginBottom: '1.5rem' }}>
            <CheckCircle size={64} style={{ display: 'inline' }} />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Chúc mừng bạn!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Cửa hàng của bạn đã sẵn sàng hoạt động.</p>
          
          <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '800' }}>Mã cửa hàng (Shop Code)</label>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '2px' }}>{successData.shopCode}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '800' }}>Tên đăng nhập</label>
              <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{successData.username}</div>
            </div>
          </div>

          <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.875rem', color: '#92400e', marginBottom: '2rem', textAlign: 'left', display: 'flex', gap: '0.75rem' }}>
            <Shield size={20} style={{ flexShrink: 0 }} />
            <span>Hãy lưu lại <strong>Mã cửa hàng</strong> này để cung cấp cho nhân viên đăng nhập.</span>
          </div>

          <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ width: '100%', height: '50px' }}>
            Bắt đầu quản lý ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-main)' }}>
      {/* Left side - Branding */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4rem', color: 'white', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }}></div>
        <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '50px', height: '50px', background: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Scissors size={28} />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>Spa & POS</h1>
          </div>
          <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1.5rem', lineHeight: 1.2 }}>Quản lý Spa chuyên nghiệp & Tối giản.</h2>
          <p style={{ fontSize: '1.25rem', opacity: 0.9, marginBottom: '3rem', maxWidth: '500px' }}>
            Hệ thống quản lý SaaS giúp bạn kiểm soát doanh thu, hoa hồng và giường phòng mọi lúc, mọi nơi.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={20} /></div>
              <span>Tạo cửa hàng nhanh trong 30 giây</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={20} /></div>
              <span>Bảo mật dữ liệu chuẩn quốc tế</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div style={{ width: '550px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'white' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Đăng ký ngay</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Bắt đầu trải nghiệm miễn phí 30 ngày.</p>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
              <Shield size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label className="form-label">Tên cửa hàng của bạn</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ví dụ: Spa Anna, Viện thẩm mỹ..." 
                  required
                  style={{ paddingLeft: '2.75rem' }}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Tên đăng nhập quản trị</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="admin, quanly..." 
                  required
                  style={{ paddingLeft: '2.75rem' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>Không bao gồm khoảng trắng và ký tự đặc biệt.</p>
            </div>

            <div>
              <label className="form-label">Mật khẩu</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Tối thiểu 6 ký tự" 
                  required
                  style={{ paddingLeft: '2.75rem' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '54px', fontSize: '1.125rem' }} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : 'Tạo cửa hàng miễn phí'}
              </button>
            </div>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Bạn đã có tài khoản? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>Đăng nhập ngay</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
