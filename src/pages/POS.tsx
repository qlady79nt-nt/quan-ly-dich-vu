import { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Trash2, 
  Loader2,
  Package as PackageIcon,
  Zap,
  Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const POS = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [activeTab, setActiveTab] = useState<'retail' | 'sell_package' | 'use_package'>('retail');
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- RETAIL STATE ---
  const [cart, setCart] = useState<any[]>([]);
  const [retailStaffId, setRetailStaffId] = useState('');
  const [retailDiscount, setRetailDiscount] = useState(0);

  // --- SELL PACKAGE STATE ---
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [sellerId, setSellerId] = useState('');

  // --- USE PACKAGE STATE ---
  const [searchPhone, setSearchPhone] = useState('');
  const [foundPackages, setFoundPackages] = useState<any[]>([]);
  const [selectedCustPkgId, setSelectedCustPkgId] = useState('');
  const [technicianId, setTechnicianId] = useState('');

  useEffect(() => {
    if (shopId) {
      fetchData();
    }
  }, [shopId]);

  const fetchData = async () => {
    setLoading(true);
    const [svc, pkg, stf] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId).eq('status', 'active'),
      supabase.from('packages').select('*, services(name)').eq('shop_id', shopId).eq('status', 'active'),
      supabase.from('profiles').select('*').eq('shop_id', shopId).eq('status', 'active')
    ]);
    setServices(svc.data || []);
    setPackages(pkg.data || []);
    setStaff(stf.data || []);
    setLoading(false);
  };

  // --- HANDLERS ---
  
  const addToCart = (svc: any) => {
    setCart([...cart, { ...svc, cartId: Math.random() }]);
  };

  const handleRetailCheckout = async () => {
    if (cart.length === 0) return alert('Giỏ hàng trống');
    if (!retailStaffId) return alert('Vui lòng chọn nhân viên thực hiện');
    
    setLoading(true);
    try {
      // 1. Tạo các Service Session (1:1 staff)
      for (const item of cart) {
        // Tính hoa hồng
        let comm = 0;
        if (item.commission_type === 'percent') {
          comm = (item.price * item.commission_value) / 100;
        } else {
          comm = item.commission_value;
        }

        const { data: sess, error: sessErr } = await supabase.from('service_sessions').insert([{
          shop_id: shopId,
          service_id: item.id,
          staff_id: retailStaffId,
          revenue_amount: item.price, // Chia sẻ giảm giá nếu cần, ở đây giả định giá sau giảm
          commission_amount: comm,
          status: 'completed'
        }]).select().single();

        if (sessErr) throw sessErr;

        // 2. Ghi log doanh thu
        await supabase.from('revenue_logs').insert([{
          shop_id: shopId,
          amount: item.price,
          type: 'retail',
          reference_id: sess.id
        }]);

        // 3. Ghi log hoa hồng
        await supabase.from('commission_logs').insert([{
          shop_id: shopId,
          staff_id: retailStaffId,
          amount: comm,
          type: 'service_execution',
          reference_id: sess.id,
          note: `Làm dịch vụ lẻ: ${item.name}`
        }]);
      }

      alert('Thanh toán thành công!');
      setCart([]);
      setRetailDiscount(0);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
    setLoading(false);
  };

  const handleSellPackage = async () => {
    if (!customerPhone || !selectedPkgId || !sellerId) return alert('Thiếu thông tin');
    
    setLoading(true);
    try {
      const pkg = packages.find(p => p.id === selectedPkgId);
      
      // 1. Tạo Customer Package
      const { data: custPkg, error: cpErr } = await supabase.from('customer_packages').insert([{
        shop_id: shopId,
        package_id: selectedPkgId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total_sessions: pkg.total_sessions,
        used_sessions: 0,
        sale_price: pkg.sale_price
      }]).select().single();

      if (cpErr) throw cpErr;

      // 2. Ghi nhận Giao dịch bán (Cashflow, không phải Revenue)
      let salesComm = 0;
      if (pkg.commission_sale_type === 'percent') {
        salesComm = (pkg.sale_price * pkg.commission_sale_value) / 100;
      } else {
        salesComm = pkg.commission_sale_value;
      }

      const { data: sale, error: saleErr } = await supabase.from('package_sales').insert([{
        shop_id: shopId,
        customer_package_id: custPkg.id,
        seller_id: sellerId,
        amount_paid: pkg.sale_price,
        commission_amount: salesComm
      }]).select().single();

      if (saleErr) throw saleErr;

      // 3. Ghi log hoa hồng bán hàng
      await supabase.from('commission_logs').insert([{
        shop_id: shopId,
        staff_id: sellerId,
        amount: salesComm,
        type: 'package_sale',
        reference_id: sale.id,
        note: `Bán liệu trình: ${pkg.name}`
      }]);

      alert('Bán liệu trình thành công! (Dòng tiền đã được ghi nhận, doanh thu sẽ tính khi khách sử dụng)');
      setCustomerPhone('');
      setCustomerName('');
      setSelectedPkgId('');
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
    setLoading(false);
  };

  const handleSearchPackage = async () => {
    if (!searchPhone) return;
    setLoading(true);
    const { data } = await supabase
      .from('customer_packages')
      .select('*, packages(name, service_id, services(*))')
      .eq('customer_phone', searchPhone)
      .eq('status', 'active');
    
    setFoundPackages(data || []);
    setLoading(false);
  };

  const handleUseSession = async () => {
    if (!selectedCustPkgId || !technicianId) return alert('Vui lòng chọn gói và KTV');
    
    setLoading(true);
    try {
      const cp = foundPackages.find(p => p.id === selectedCustPkgId);
      const svc = cp.packages.services;
      const unitPrice = cp.sale_price / cp.total_sessions; // Doanh thu thực mỗi buổi

      // 1. Tạo Service Session
      let comm = 0;
      if (svc.commission_type === 'percent') {
        comm = (unitPrice * svc.commission_value) / 100;
      } else {
        comm = svc.commission_value;
      }

      const { data: sess, error: sessErr } = await supabase.from('service_sessions').insert([{
        shop_id: shopId,
        service_id: svc.id,
        staff_id: technicianId,
        customer_package_id: cp.id,
        revenue_amount: unitPrice,
        commission_amount: comm,
        status: 'completed'
      }]).select().single();

      if (sessErr) throw sessErr;

      // 2. Cập nhật số buổi
      const newUsed = cp.used_sessions + 1;
      await supabase.from('customer_packages')
        .update({ 
          used_sessions: newUsed,
          status: newUsed >= cp.total_sessions ? 'completed' : 'active'
        })
        .eq('id', cp.id);

      // 3. Ghi log doanh thu (Lúc này mới tính doanh thu thực)
      await supabase.from('revenue_logs').insert([{
        shop_id: shopId,
        amount: unitPrice,
        type: 'package_session',
        reference_id: sess.id
      }]);

      // 4. Ghi log hoa hồng
      await supabase.from('commission_logs').insert([{
        shop_id: shopId,
        staff_id: technicianId,
        amount: comm,
        type: 'service_execution',
        reference_id: sess.id,
        note: `Sử dụng liệu trình: ${cp.packages.name}`
      }]);

      alert('Đã trừ 1 buổi và ghi nhận doanh thu + hoa hồng!');
      setSearchPhone('');
      setFoundPackages([]);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 380px' }}>
      {/* Cột trái: Chọn dịch vụ/khách */}
      <div>
        <div className="premium-card" style={{ marginBottom: '1.5rem', padding: '0.5rem' }}>
          <div style={{ display: 'flex' }}>
            <button 
              onClick={() => setActiveTab('retail')}
              style={{ flex: 1, padding: '1rem', background: activeTab === 'retail' ? 'var(--primary)' : 'transparent', color: activeTab === 'retail' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Zap size={18} /> Bán lẻ dịch vụ
            </button>
            <button 
              onClick={() => setActiveTab('sell_package')}
              style={{ flex: 1, padding: '1rem', background: activeTab === 'sell_package' ? 'var(--primary)' : 'transparent', color: activeTab === 'sell_package' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <PackageIcon size={18} /> Bán liệu trình
            </button>
            <button 
              onClick={() => setActiveTab('use_package')}
              style={{ flex: 1, padding: '1rem', background: activeTab === 'use_package' ? 'var(--primary)' : 'transparent', color: activeTab === 'use_package' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Calendar size={18} /> Dùng liệu trình
            </button>
          </div>
        </div>

        {activeTab === 'retail' && (
          <div className="animate-fade">
            <div className="premium-card" style={{ marginBottom: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input type="text" className="form-input" placeholder="Tìm dịch vụ lẻ..." style={{ paddingLeft: '2.75rem' }} />
              </div>
            </div>
            <div className="grid grid-cols-2">
              {services.map(s => (
                <div key={s.id} onClick={() => addToCart(s)} className="premium-card" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{s.name}</h4>
                    <div style={{ color: 'var(--primary)', fontWeight: '700' }}>{Number(s.price).toLocaleString()}đ</div>
                  </div>
                  <Plus size={20} color="var(--text-light)" />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sell_package' && (
          <div className="premium-card animate-fade">
            <h3 style={{ marginBottom: '1.5rem' }}>Bán gói liệu trình cho khách</h3>
            <div className="grid" style={{ gap: '1.25rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Số điện thoại khách *</label>
                <input type="tel" className="form-input" placeholder="09xxxxxxx" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Tên khách hàng</label>
                <input type="text" className="form-input" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Chọn liệu trình</label>
                <select className="form-select" value={selectedPkgId} onChange={e => setSelectedPkgId(e.target.value)}>
                  <option value="">-- Chọn gói --</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name} ({Number(p.sale_price).toLocaleString()}đ)</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Nhân viên tư vấn (Bán)</label>
                <select className="form-select" value={sellerId} onChange={e => setSellerId(e.target.value)}>
                  <option value="">-- Chọn nhân viên --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <button onClick={handleSellPackage} disabled={loading} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', height: '50px' }}>
                {loading ? <Loader2 className="animate-spin" /> : 'Xác nhận bán gói'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'use_package' && (
          <div className="animate-fade">
            <div className="premium-card" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Tìm khách hàng theo SĐT</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="tel" className="form-input" placeholder="09xxxxxxx" value={searchPhone} onChange={e => setSearchPhone(e.target.value)} />
                <button onClick={handleSearchPackage} className="btn btn-primary"><Search size={18} /></button>
              </div>
            </div>

            {foundPackages.length > 0 && (
              <div className="grid">
                {foundPackages.map(cp => (
                  <div key={cp.id} onClick={() => setSelectedCustPkgId(cp.id)} className="premium-card" style={{ border: selectedCustPkgId === cp.id ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <h4 style={{ fontSize: '1.1rem' }}>{cp.packages.name}</h4>
                      <span className="badge badge-primary">Còn {cp.total_sessions - cp.used_sessions} buổi</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Dịch vụ: {cp.packages.services.name}</p>
                  </div>
                ))}

                {selectedCustPkgId && (
                  <div className="premium-card animate-fade" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--success)' }}>
                    <label className="form-label" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Nhân viên thực hiện hôm nay *</label>
                    <select className="form-select" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
                      <option value="">-- Chọn kỹ thuật viên --</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                    <button onClick={handleUseSession} disabled={loading} className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%', height: '50px', background: 'var(--success)' }}>
                      {loading ? <Loader2 className="animate-spin" /> : 'Xác nhận trừ buổi & Tính HH'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cột phải: Thanh toán (Chỉ cho Retail) */}
      <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '1.5rem' }}>
        <div className="premium-card" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
            <ShoppingCart size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem' }}>Đơn hàng bán lẻ</h3>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-light)', marginTop: '2rem' }}>Chưa có dịch vụ nào</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cart.map((item, idx) => (
                  <div key={item.cartId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px dashed var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{item.name}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>{Number(item.price).toLocaleString()}đ</div>
                    </div>
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>NV thực hiện (1:1)</label>
                <select className="form-select" value={retailStaffId} onChange={e => setRetailStaffId(e.target.value)}>
                  <option value="">-- Chọn nhân viên --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span>Tạm tính:</span>
                <span>{cart.reduce((a, b) => a + Number(b.price), 0).toLocaleString()}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontWeight: '800', fontSize: '1.1rem', color: 'var(--danger)' }}>
                <span>Tổng thanh toán:</span>
                <span>{(cart.reduce((a, b) => a + Number(b.price), 0) - retailDiscount).toLocaleString()}đ</span>
              </div>
              
              <button onClick={handleRetailCheckout} disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem' }}>
                {loading ? <Loader2 className="animate-spin" /> : 'THANH TOÁN NGAY'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POS;
