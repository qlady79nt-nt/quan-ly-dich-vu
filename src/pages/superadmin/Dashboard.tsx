import { useState, useEffect } from 'react';
import { Store, Plus, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SuperAdminDashboard = () => {
  const [shops, setShops] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    shopName: '',
    email: '',
    planId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: plansData } = await supabase.from('plans').select('*').order('price', { ascending: true });
      if (plansData) {
        setPlans(plansData);
        if (plansData.length > 0) setForm(prev => ({ ...prev, planId: plansData[0].id }));
      }

      const { data: shopsData } = await supabase
        .from('shops')
        .select(`
          id, name, shop_code, expired_at, status,
          subscriptions ( status, plans ( name ) )
        `)
        .order('created_at', { ascending: false });
      if (shopsData) setShops(shopsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateShopCode = () => {
    const letters = Math.random().toString(36).substring(2, 5).toUpperCase();
    const numbers = Math.floor(100 + Math.random() * 900);
    return letters + numbers;
  };

  const handleCreateShop = async () => {
    if (!form.shopName || !form.email) {
      alert('Vui lòng điền tên shop và email chủ tiệm');
      return;
    }
    
    if (!form.planId) {
      alert('Danh sách Gói Dịch Vụ đang trống!\nBạn cần vào Supabase > SQL Editor chạy lệnh INSERT INTO plans... để nạp dữ liệu gói trước khi tạo Shop.');
      return;
    }
    
    setCreating(true);
    try {
      const shopCode = generateShopCode();
      const selectedPlan = plans.find(p => p.id === form.planId);
      
      let expiredAt = new Date();
      if (selectedPlan?.price === 0) {
        expiredAt.setDate(expiredAt.getDate() + 30); // Free 30 days
      } else {
        expiredAt.setFullYear(expiredAt.getFullYear() + 1); // Pro 1 year
      }

      // 1. Tạo Shop mới
      const { data: newShop, error: shopError } = await supabase
        .from('shops')
        .insert({ 
          name: form.shopName,
          shop_code: shopCode,
          plan_id: form.planId,
          expired_at: expiredAt.toISOString(),
          status: 'active'
        })
        .select()
        .single();
        
      if (shopError) throw shopError;

      // 2. Gán Subscription
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          shop_id: newShop.id,
          plan_id: form.planId,
          start_date: new Date().toISOString(),
          end_date: expiredAt.toISOString(),
          status: 'active'
        });

      if (subError) throw subError;

      alert(`Khởi tạo Shop "${form.shopName}" thành công!\n\n🔑 MÃ SHOP CỦA KHÁCH HÀNG: ${shopCode}\n\n👉 BƯỚC TIẾP THEO: Gửi mã Shop này cho khách hàng (${form.email}). Khách hàng sẽ vào trang Đăng Ký, nhập Email, Mật khẩu và Mã Shop này để tự động trở thành Chủ Tiệm (Shop Admin).`);
      
      setForm({ shopName: '', email: '', planId: plans[0]?.id || '' });
      fetchData();
    } catch (error: any) {
      alert('Lỗi tạo shop: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /> Đang tải dữ liệu...</div>;

  return (
    <div className="grid-cols-2">
      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Store size={24} />
          Tạo Shop Mới (Onboarding)
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Hệ thống sẽ cấp một Mã Shop (Shop Code). Chủ tiệm dùng mã này để đăng ký tài khoản.
        </p>
        
        <div className="form-group">
          <label className="form-label">Tên cửa tiệm (Tên hiển thị)</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Ví dụ: Thẩm Mỹ Viện XYZ" 
            value={form.shopName}
            onChange={e => setForm({...form, shopName: e.target.value})}
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Email liên hệ của Chủ Tiệm (Để quản lý)</label>
          <input 
            type="email" 
            className="form-input" 
            placeholder="admin@xyz.com" 
            value={form.email}
            onChange={e => setForm({...form, email: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Gán Gói Dịch Vụ (SaaS Plan)</label>
          <select 
            className="form-select"
            value={form.planId}
            onChange={e => setForm({...form, planId: e.target.value})}
          >
            {plans.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (Tối đa {p.max_users} User, {p.max_branches} Chi nhánh) - {p.price === 0 ? 'Miễn phí 30 ngày' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price) + '/năm'}
              </option>
            ))}
          </select>
        </div>

        <button 
          className="btn-primary" 
          onClick={handleCreateShop}
          disabled={creating}
          style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--success-color)', boxShadow: 'none' }}
        >
          {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
          Khởi tạo Shop & Sinh Mã
        </button>
      </div>

      <div>
        <div className="premium-card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Danh sách Shop (Tenants)
          </h2>
          {shops.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Chưa có shop nào.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.5rem' }}>Mã Shop</th>
                  <th style={{ padding: '0.5rem' }}>Tên Shop</th>
                  <th style={{ padding: '0.5rem' }}>Gói</th>
                  <th style={{ padding: '0.5rem' }}>Hết hạn</th>
                  <th style={{ padding: '0.5rem' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop, idx) => {
                  const sub = shop.subscriptions?.[0];
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{shop.shop_code}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{shop.name}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{sub?.plans?.name || 'Không có'}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{shop.expired_at ? new Date(shop.expired_at).toLocaleDateString('vi-VN') : '---'}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        {shop.status === 'active' ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-danger">Expired</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="premium-card" style={{ border: '1px solid var(--danger-color)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldAlert size={20} />
            Hệ thống Bảo Mật
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Cơ chế RLS (Row Level Security)</strong> đang hoạt động.<br/><br/>
            Mỗi Shop Admin (Chủ tiệm) chỉ có thể truy vấn dữ liệu (nhân viên, hoá đơn, giường) có chứa <code>shop_id</code> của họ. 
            Backend tự động block (throw Forbidden) nếu cố tình thay đổi <code>shop_id</code> trong payload API.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
