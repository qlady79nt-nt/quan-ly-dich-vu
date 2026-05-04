import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SetupShop = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopData, setShopData] = useState({ id: '', name: '', shopCode: '' });
  const [profileData, setProfileData] = useState({ id: '', fullName: '', email: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setProfileData({
          id: profile.id,
          fullName: profile.full_name || '',
          email: user.email || ''
        });

        // Get shop details if shop_id exists
        if (profile.shop_id) {
          const { data: shop } = await supabase
            .from('shops')
            .select('*')
            .eq('id', profile.shop_id)
            .single();
            
          if (shop) {
            setShopData({
              id: shop.id,
              name: shop.name || '',
              shopCode: shop.shop_code || ''
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update Shop Name
      if (shopData.id) {
        const { error: shopError } = await supabase
          .from('shops')
          .update({ name: shopData.name })
          .eq('id', shopData.id);
        if (shopError) throw shopError;
      }

      // 2. Update Profile Name
      if (profileData.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: profileData.fullName })
          .eq('id', profileData.id);
        if (profileError) throw profileError;
      }

      alert('Đã lưu cấu hình thành công!');
    } catch (error: any) {
      alert('Lỗi khi lưu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /> Đang tải dữ liệu...</div>;
  }

  return (
    <div className="premium-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>Cấu Hình Cửa Tiệm</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Quản lý thông tin hiển thị của cửa hàng và tài khoản quản trị của bạn.
      </p>

      <div className="grid-cols-2">
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Thông tin Cửa hàng</h3>
          
          <div className="form-group">
            <label className="form-label">Mã Shop (Shop Code)</label>
            <input 
              type="text" 
              className="form-input" 
              value={shopData.shopCode} 
              disabled 
              style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-light)', cursor: 'not-allowed' }}
            />
            <small style={{ color: 'var(--text-light)' }}>Mã này dùng để nhân viên đăng ký vào tiệm.</small>
          </div>

          <div className="form-group">
            <label className="form-label">Tên Cửa hàng (Shop Name)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ví dụ: Beauty Spa Cao Cấp" 
              value={shopData.name}
              onChange={e => setShopData({...shopData, name: e.target.value})}
            />
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Tài khoản Admin</h3>
          <div className="form-group">
            <label className="form-label">Tên hiển thị Admin</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ví dụ: Nguyễn Văn A" 
              value={profileData.fullName}
              onChange={e => setProfileData({...profileData, fullName: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email đăng nhập (Không thể đổi)</label>
            <input 
              type="email" 
              className="form-input" 
              value={profileData.email} 
              disabled
              style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-light)', cursor: 'not-allowed' }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className="btn-primary" 
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--success-color)' }}
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {saving ? 'Đang lưu...' : 'Lưu cấu hình hệ thống'}
        </button>
      </div>
    </div>
  );
};

export default SetupShop;
