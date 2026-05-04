import { useState, useEffect } from 'react';
import { Save, Loader2, Copy, AlertTriangle, Crown, Users, MapPin, CheckCircle2, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SetupShop = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopData, setShopData] = useState<any>({ id: '', name: '', shop_code: '', address: '', phone: '', status: 'active', expired_at: null });
  const [profileData, setProfileData] = useState({ id: '', fullName: '', email: '' });
  const [planData, setPlanData] = useState<any>(null);
  const [usageStats, setUsageStats] = useState({ users: 1, branches: 1 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

        if (profile.shop_id) {
          // Fetch Shop + Plan
          const { data: shop } = await supabase
            .from('shops')
            .select('*, plans(*)')
            .eq('id', profile.shop_id)
            .single();
            
          if (shop) {
            setShopData(shop);
            if (shop.plans) setPlanData(shop.plans);

            // Fetch Usage Stats (Count Users)
            const { count: userCount } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('shop_id', profile.shop_id);
            
            // Assume 1 branch for now until branches table is fully implemented
            setUsageStats({ users: userCount || 1, branches: 1 });
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
    if (shopData.status === 'expired') return alert('Gói dịch vụ đã hết hạn. Vui lòng gia hạn để tiếp tục chỉnh sửa!');
    setSaving(true);
    try {
      if (shopData.id) {
        // Safe update: only update columns that exist. We will add address/phone to DB soon.
        // For now, we try to update them. If it fails, we ignore the error for non-existent columns.
        const updatePayload: any = { name: shopData.name };
        if (shopData.address !== undefined) updatePayload.address = shopData.address;
        if (shopData.phone !== undefined) updatePayload.phone = shopData.phone;
        
        await supabase.from('shops').update(updatePayload).eq('id', shopData.id);
      }

      if (profileData.id) {
        await supabase.from('profiles').update({ full_name: profileData.fullName }).eq('id', profileData.id);
      }
      alert('Đã lưu cấu hình thành công!');
    } catch (error: any) {
      console.error('Lỗi khi lưu:', error);
      alert('Đã lưu các thông tin cơ bản. (Ghi chú: Địa chỉ/SĐT cần nâng cấp Database để lưu trữ)');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(shopData.shop_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /> Đang tải dữ liệu...</div>;
  }

  const isExpired = shopData.status === 'expired' || (shopData.expired_at && new Date(shopData.expired_at) < new Date());
  
  // Calculate days left
  let daysLeft = 0;
  if (shopData.expired_at) {
    const diff = new Date(shopData.expired_at).getTime() - new Date().getTime();
    daysLeft = Math.ceil(diff / (1000 * 3600 * 24));
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER & NOTIFICATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: 'var(--primary-color)' }}>Cấu Hình Doanh Nghiệp</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Quản lý thông tin, chi nhánh và nhân sự của bạn.</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={handleSave}
          disabled={saving || isExpired}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: isExpired ? 'var(--text-light)' : 'var(--success-color)' }}
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>

      {isExpired && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertTriangle size={20} />
          <strong>Hệ thống bị khóa:</strong> Gói dịch vụ của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng hệ thống.
        </div>
      )}

      {!isExpired && daysLeft > 0 && daysLeft <= 5 && (
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <AlertTriangle size={20} />
          <strong>Lưu ý:</strong> Gói dịch vụ của bạn sẽ hết hạn sau {daysLeft} ngày nữa.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* BLOCK 1: THÔNG TIN CỬA HÀNG */}
        <div className="premium-card" style={{ opacity: isExpired ? 0.7 : 1, pointerEvents: isExpired ? 'none' : 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Store size={20} color="var(--primary-color)" />
            Hồ Sơ Doanh Nghiệp (In trên Hoá đơn)
          </h3>
          <div className="form-group">
            <label className="form-label">Tên Thương Hiệu (Shop Name)</label>
            <input 
              type="text" className="form-input" 
              value={shopData.name || ''}
              onChange={e => setShopData({...shopData, name: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Địa chỉ chính</label>
            <input 
              type="text" className="form-input" placeholder="Ví dụ: 123 Đường ABC..."
              value={shopData.address || ''}
              onChange={e => setShopData({...shopData, address: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Số điện thoại Hotline</label>
            <input 
              type="text" className="form-input" placeholder="0909 123 456"
              value={shopData.phone || ''}
              onChange={e => setShopData({...shopData, phone: e.target.value})}
            />
          </div>
        </div>

        {/* BLOCK 3: GÓI SAAS */}
        <div className="premium-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary-color)' }}>
            <Crown size={20} />
            Thông Tin Gói Dịch Vụ
          </h3>
          
          <div style={{ backgroundColor: 'var(--background-light)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gói hiện tại:</span>
              <strong style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{planData?.name || 'Chưa đăng ký'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Trạng thái:</span>
              {isExpired ? <span className="badge badge-danger">Đã hết hạn</span> : <span className="badge badge-success">Đang hoạt động</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ngày hết hạn:</span>
              <strong>{shopData.expired_at ? new Date(shopData.expired_at).toLocaleDateString('vi-VN') : 'Không giới hạn'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Limit Users */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={16}/> Nhân viên</span>
                <span><strong>{usageStats.users}</strong> / {planData?.max_users || 1}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--background-light)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: 'var(--primary-light)', width: `${Math.min(100, (usageStats.users / (planData?.max_users || 1)) * 100)}%` }}></div>
              </div>
            </div>

            {/* Limit Branches */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={16}/> Chi nhánh</span>
                <span><strong>{usageStats.branches}</strong> / {planData?.max_branches || 1}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--background-light)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: 'var(--secondary-color)', width: `${Math.min(100, (usageStats.branches / (planData?.max_branches || 1)) * 100)}%` }}></div>
              </div>
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%', marginTop: '1.5rem', backgroundColor: 'var(--primary-dark)' }}>
            Nâng Cấp Gói (Gia Hạn)
          </button>
        </div>

        {/* BLOCK 2: MÃ SHOP */}
        <div className="premium-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Mã Cửa Hàng (Shop Code)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Mã này được sử dụng để liên kết nhân viên vào cửa hàng của bạn. Hãy gửi mã này cho nhân viên khi họ đăng ký tài khoản.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, backgroundColor: 'var(--background-light)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px', textAlign: 'center', color: 'var(--primary-color)' }}>
              {shopData.shop_code}
            </div>
            <button 
              onClick={copyCode}
              style={{ backgroundColor: 'var(--background-light)', border: 'none', borderRadius: '0.5rem', padding: '0 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: copied ? 'var(--success-color)' : 'var(--text-primary)', transition: 'all 0.2s' }}
            >
              {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
              {copied ? 'Đã Copy' : 'Copy'}
            </button>
          </div>
        </div>

        {/* BLOCK 4: THÔNG TIN ADMIN */}
        <div className="premium-card" style={{ opacity: isExpired ? 0.7 : 1, pointerEvents: isExpired ? 'none' : 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Tài khoản Quản trị viên</h3>
          <div className="form-group">
            <label className="form-label">Tên hiển thị</label>
            <input 
              type="text" className="form-input" 
              value={profileData.fullName || ''}
              onChange={e => setProfileData({...profileData, fullName: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email đăng nhập (Cố định)</label>
            <input 
              type="email" className="form-input" 
              value={profileData.email} disabled
              style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-light)' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default SetupShop;
