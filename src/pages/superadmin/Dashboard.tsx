import { useState, useEffect } from 'react';
import { Store, Plus, Loader2 } from 'lucide-react';
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
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>
          Super Admin Dashboard
        </h1>
        <p style={{ color: '#888' }}>
          Quản lý toàn bộ hệ thống SaaS
        </p>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="premium-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2rem', color: 'var(--primary-color)' }}>{shops.length}</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Tổng Shop</p>
        </div>
        <div className="premium-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2rem', color: 'var(--success-color)' }}>{shops.filter(s => s.status === 'active').length}</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Đang hoạt động</p>
        </div>
        <div className="premium-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2rem', color: 'var(--danger-color)' }}>{shops.filter(s => s.status !== 'active').length}</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Hết hạn</p>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* FORM */}
        <div className="premium-card">
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)' }}>
            <Plus size={24} /> Tạo Shop mới
          </h2>

          <div className="form-group">
            <label className="form-label">Tên cửa tiệm</label>
            <input
              className="form-input"
              placeholder="Thẩm Mỹ Viện XYZ"
              value={form.shopName}
              onChange={e => setForm({...form, shopName: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email chủ tiệm</label>
            <input
              className="form-input"
              placeholder="admin@xyz.com"
              type="email"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Gói Dịch Vụ (Plan)</label>
            <select
              className="form-select"
              value={form.planId}
              onChange={e => setForm({...form, planId: e.target.value})}
            >
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - {p.price === 0 ? 'Free' : p.price.toLocaleString() + 'đ'}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-primary"
            onClick={handleCreateShop}
            disabled={creating}
            style={{ width: '100%', marginTop: '1rem', backgroundColor: 'var(--success-color)' }}
          >
            {creating ? <Loader2 className="animate-spin" style={{ display: 'inline', marginRight: '0.5rem' }} size={20} /> : null}
            {creating ? 'Đang tạo...' : 'Tạo Shop & Sinh mã'}
          </button>
        </div>

        {/* TABLE */}
        <div className="premium-card" style={{ overflowX: 'auto' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Store size={24} /> Danh sách Shop
          </h2>

          {shops.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Chưa có shop nào.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Mã</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Tên</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Hết hạn</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {shops.map(shop => (
                  <tr key={shop.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem 0.5rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                      {shop.shop_code}
                    </td>
                    <td style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>{shop.name}</td>
                    <td style={{ padding: '1rem 0.5rem' }}>
                      {shop.expired_at
                        ? new Date(shop.expired_at).toLocaleDateString('vi-VN')
                        : '-'}
                    </td>
                    <td style={{ padding: '1rem 0.5rem' }}>
                      <span className={`badge badge-${shop.status === 'active' ? 'success' : 'danger'}`}>
                        {shop.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
