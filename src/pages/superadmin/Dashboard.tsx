import { useState, useEffect } from 'react';
import { Store, Plus, Loader2, Lock, Unlock, RefreshCw, Search, Crown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SuperAdminDashboard = () => {
  const [shops, setShops] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ shopName: '', email: '', planId: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: plansData } = await supabase.from('plans').select('*').order('price', { ascending: true });
      if (plansData) {
        setPlans(plansData);
        if (plansData.length > 0) setForm(prev => ({ ...prev, planId: plansData[0].id }));
      }

      const { data: shopsData } = await supabase
        .from('shops')
        .select(`*, plans(name, max_users, max_branches)`)
        .order('created_at', { ascending: false });
      if (shopsData) setShops(shopsData);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const generateShopCode = () => {
    const letters = Math.random().toString(36).substring(2, 5).toUpperCase();
    const numbers = Math.floor(100 + Math.random() * 900);
    return letters + numbers;
  };

  const handleCreateShop = async () => {
    if (!form.shopName || !form.email) return alert('Vui lòng điền đủ thông tin');
    if (!form.planId) return alert('Vui lòng chọn Gói dịch vụ');
    setCreating(true);
    try {
      const shopCode = generateShopCode();
      const selectedPlan = plans.find(p => p.id === form.planId);
      const expiredAt = new Date();
      selectedPlan?.price === 0
        ? expiredAt.setDate(expiredAt.getDate() + 30)
        : expiredAt.setFullYear(expiredAt.getFullYear() + 1);

      const { data: newShop, error } = await supabase
        .from('shops')
        .insert({ name: form.shopName, shop_code: shopCode, plan_id: form.planId, expired_at: expiredAt.toISOString(), status: 'active' })
        .select().single();
      if (error) throw error;

      alert(`✅ Tạo Shop thành công!\n\n🏪 Tên: ${form.shopName}\n🔑 MÃ SHOP: ${shopCode}\n\n👉 Gửi mã này cho khách hàng (${form.email}) để đăng ký tài khoản.`);
      setForm({ shopName: '', email: '', planId: plans[0]?.id || '' });
      fetchData();
      return newShop;
    } catch (error: any) {
      alert('Lỗi: ' + error.message);
    } finally { setCreating(false); }
  };

  const handleToggleLock = async (shop: any) => {
    const newStatus = shop.status === 'active' ? 'locked' : 'active';
    const msg = newStatus === 'locked'
      ? `Khoá shop "${shop.name}"? Shop sẽ không thể truy cập.`
      : `Mở khoá shop "${shop.name}"?`;
    if (!confirm(msg)) return;
    setActionLoading(shop.id);
    try {
      await supabase.from('shops').update({ status: newStatus }).eq('id', shop.id);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleExtend = async (shop: any) => {
    const months = prompt('Gia hạn thêm bao nhiêu tháng?', '12');
    if (!months || isNaN(Number(months))) return;
    setActionLoading(shop.id);
    try {
      const currentExpiry = shop.expired_at ? new Date(shop.expired_at) : new Date();
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()));
      newExpiry.setMonth(newExpiry.getMonth() + Number(months));
      await supabase.from('shops').update({ expired_at: newExpiry.toISOString(), status: 'active' }).eq('id', shop.id);
      alert(`✅ Đã gia hạn shop "${shop.name}" thêm ${months} tháng`);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const filteredShops = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.shop_code.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: shops.length,
    active: shops.filter(s => s.status === 'active').length,
    locked: shops.filter(s => s.status === 'locked').length,
    expired: shops.filter(s => {
      if (s.status !== 'active') return false;
      return s.expired_at && new Date(s.expired_at) < new Date();
    }).length,
  };

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--primary-color)' }}>
      <Loader2 className="animate-spin" style={{ display: 'inline', marginRight: '0.5rem' }} size={24} />
      Đang tải dữ liệu...
    </div>
  );

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>Quản lý Tenant (Shop)</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Tạo và quản lý toàn bộ khách hàng SaaS.</p>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Tổng Shop', value: stats.total, color: 'var(--primary-color)', bg: 'rgba(109,40,217,0.08)' },
          { label: 'Đang hoạt động', value: stats.active, color: 'var(--success-color)', bg: 'rgba(16,185,129,0.08)' },
          { label: 'Đã khoá', value: stats.locked, color: 'var(--warning-color)', bg: 'rgba(245,158,11,0.08)' },
          { label: 'Hết hạn', value: stats.expired, color: 'var(--danger-color)', bg: 'rgba(239,68,68,0.08)' },
        ].map(stat => (
          <div key={stat.label} className="premium-card" style={{ textAlign: 'center', background: stat.bg, border: `1px solid ${stat.color}20` }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem' }}>

        {/* FORM TẠO SHOP */}
        <div className="premium-card" style={{ alignSelf: 'start', position: 'sticky', top: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)', fontSize: '1.1rem' }}>
            <Plus size={22} /> Tạo Shop Mới
          </h2>

          <div className="form-group">
            <label className="form-label">Tên cửa tiệm *</label>
            <input className="form-input" placeholder="Thẩm Mỹ Viện XYZ" value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email chủ tiệm *</label>
            <input className="form-input" type="email" placeholder="admin@xyz.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Gói Dịch Vụ (Plan)</label>
            <select className="form-select" value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}>
              {plans.length === 0
                ? <option disabled>Chưa có gói — tạo tại tab Quản lý Gói</option>
                : plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {p.price === 0 ? 'Free (30 ngày)' : p.price.toLocaleString('vi-VN') + 'đ/năm'}
                  </option>
                ))
              }
            </select>
          </div>
          <button className="btn-primary" onClick={handleCreateShop} disabled={creating || plans.length === 0}
            style={{ width: '100%', marginTop: '0.5rem', backgroundColor: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            {creating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            {creating ? 'Đang tạo...' : 'Tạo Shop & Sinh mã'}
          </button>
          {plans.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--warning-color)', marginTop: '0.75rem', textAlign: 'center' }}>
              ⚠ Vui lòng tạo Gói dịch vụ trước tại tab "Quản lý Gói"
            </p>
          )}
        </div>

        {/* DANH SÁCH SHOPS */}
        <div className="premium-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Store size={22} /> Danh sách Shop ({filteredShops.length})
            </h2>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '2.25rem', width: '220px', padding: '0.5rem 0.5rem 0.5rem 2.25rem' }}
                placeholder="Tìm shop..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {filteredShops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
              <Store size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>Chưa có shop nào</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredShops.map(shop => {
                const isExpired = shop.expired_at && new Date(shop.expired_at) < new Date();
                const daysLeft = shop.expired_at
                  ? Math.ceil((new Date(shop.expired_at).getTime() - Date.now()) / 86400000)
                  : null;
                const statusColor = shop.status === 'active' && !isExpired ? 'var(--success-color)' : shop.status === 'locked' ? 'var(--warning-color)' : 'var(--danger-color)';
                const isLoading = actionLoading === shop.id;

                return (
                  <div key={shop.id} style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', background: 'white' }}>

                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `${statusColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Store size={22} color={statusColor} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '1rem' }}>{shop.name}</strong>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(109,40,217,0.1)', color: 'var(--primary-color)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                          {shop.shop_code}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Crown size={12} /> {shop.plans?.name || 'Không có gói'}
                        </span>
                        {daysLeft !== null && (
                          <span style={{ fontSize: '0.8rem', color: isExpired ? 'var(--danger-color)' : daysLeft <= 7 ? 'var(--warning-color)' : 'var(--text-secondary)' }}>
                            {isExpired ? '⚠ Đã hết hạn' : `Còn ${daysLeft} ngày`}
                          </span>
                        )}
                        <span className={`badge badge-${shop.status === 'active' && !isExpired ? 'success' : shop.status === 'locked' ? 'warning' : 'danger'}`}
                          style={{ fontSize: '0.7rem' }}>
                          {shop.status === 'active' && !isExpired ? 'Hoạt động' : shop.status === 'locked' ? 'Khoá' : 'Hết hạn'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        onClick={() => handleExtend(shop)}
                        disabled={isLoading}
                        title="Gia hạn"
                        style={{ background: 'rgba(16,185,129,0.1)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', color: 'var(--success-color)', display: 'flex', alignItems: 'center' }}
                      >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                      </button>
                      <button
                        onClick={() => handleToggleLock(shop)}
                        disabled={isLoading}
                        title={shop.status === 'active' ? 'Khoá shop' : 'Mở khoá'}
                        style={{ background: shop.status === 'active' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', color: shop.status === 'active' ? 'var(--warning-color)' : 'var(--success-color)', display: 'flex', alignItems: 'center' }}
                      >
                        {shop.status === 'active' ? <Lock size={18} /> : <Unlock size={18} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
