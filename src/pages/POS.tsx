import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Loader2,
  Package as PackageIcon,
  Zap,
  Calendar,
  Printer,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const POS = () => {
  const { profile, hasPermission, isRestricted } = useAuth();
  const shopId = profile?.shop_id;

  const [activeTab, setActiveTab] = useState<'retail' | 'sell_package' | 'use_package'>('retail');
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<any>(null);

  // --- RETAIL STATE ---
  const [cart, setCart] = useState<any[]>([]);
  const [retailStaffId, setRetailStaffId] = useState('');
  const [retailDiscount, setRetailDiscount] = useState(0);
  const [customerName, setRetailCustomerName] = useState('');

  // --- SELL PACKAGE STATE ---
  const [customerPhone, setCustomerPhone] = useState('');
  const [pkgCustomerName, setPkgCustomerName] = useState('');
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [sellerId, setSellerId] = useState('');

  // --- USE PACKAGE STATE ---
  const [searchPhone, setSearchPhone] = useState('');
  const [foundPackages, setFoundPackages] = useState<any[]>([]);
  const [selectedCustPkgId, setSelectedCustPkgId] = useState('');
  const [technicianId, setTechnicianId] = useState('');

  useEffect(() => {
    if (shopId) fetchData();
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

  const addToCart = (svc: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện bán hàng');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền tạo đơn hàng');
    setCart([...cart, { ...svc, cartId: Math.random() }]);
  };

  const handleRetailCheckout = async () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện thanh toán');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền thanh toán');
    if (cart.length === 0) return alert('Giỏ hàng trống');
    if (!retailStaffId) return alert('Vui lòng chọn nhân viên thực hiện');
    
    setLoading(true);
    try {
      const subtotal = cart.reduce((acc, curr) => acc + Number(curr.price), 0);
      const finalTotal = subtotal - retailDiscount;

      // 1. Tạo Invoice chính
      const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
        shop_id: shopId,
        customer_name: customerName || 'Khách lẻ',
        created_by: profile?.id,
        total_amount: subtotal,
        discount_amount: retailDiscount,
        final_amount: finalTotal,
        payment_method: 'cash',
        status: 'paid'
      }]).select().single();

      if (invErr) throw invErr;

      // 2. Tạo Invoice Items & Sessions & Logs
      for (const item of cart) {
        // Invoice Item
        await supabase.from('invoice_items').insert([{
          invoice_id: inv.id,
          type: 'service',
          ref_id: item.id,
          staff_id: retailStaffId,
          unit_price: item.price,
          final_price: item.price // Giả định chưa chia nhỏ discount cho từng item
        }]);

        // Tính hoa hồng
        const comm = item.commission_type === 'percent' ? (item.price * item.commission_value) / 100 : item.commission_value;

        // Session
        const { data: sess } = await supabase.from('service_sessions').insert([{
          shop_id: shopId,
          service_id: item.id,
          staff_id: retailStaffId,
          revenue_amount: item.price,
          commission_amount: comm,
          status: 'completed'
        }]).select().single();

        // Logs
        await supabase.from('revenue_logs').insert([{ shop_id: shopId, amount: item.price, type: 'retail', reference_id: sess.id }]);
        await supabase.from('commission_logs').insert([{ shop_id: shopId, staff_id: retailStaffId, amount: comm, type: 'service_execution', reference_id: sess.id, note: `Dịch vụ lẻ: ${item.name}` }]);
      }

      setCompletedInvoice({ ...inv, items: cart });
      setCart([]);
      setRetailDiscount(0);
      setRetailCustomerName('');
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    setLoading(false);
  };

  const handleSellPackage = async () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện bán gói');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền thực hiện');
    if (!customerPhone || !selectedPkgId || !sellerId) return alert('Thiếu thông tin');
    
    setLoading(true);
    try {
      const pkg = packages.find(p => p.id === selectedPkgId);
      
      // 1. Tạo Invoice
      const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
        shop_id: shopId,
        customer_name: pkgCustomerName || 'Khách lẻ',
        customer_phone: customerPhone,
        created_by: profile?.id,
        total_amount: pkg.original_price,
        discount_amount: pkg.original_price - pkg.sale_price,
        final_amount: pkg.sale_price,
        status: 'paid'
      }]).select().single();
      if (invErr) throw invErr;

      // 2. Tạo Customer Package & Invoice Item
      const { data: custPkg } = await supabase.from('customer_packages').insert([{
        shop_id: shopId,
        package_id: selectedPkgId,
        customer_name: pkgCustomerName,
        customer_phone: customerPhone,
        total_sessions: pkg.total_sessions,
        used_sessions: 0,
        sale_price: pkg.sale_price
      }]).select().single();

      await supabase.from('invoice_items').insert([{
        invoice_id: inv.id,
        type: 'package_sale',
        ref_id: selectedPkgId,
        staff_id: sellerId,
        unit_price: pkg.original_price,
        final_price: pkg.sale_price
      }]);

      // 3. Hoa hồng & Giao dịch
      const salesComm = pkg.commission_sale_type === 'percent' ? (pkg.sale_price * pkg.commission_sale_value) / 100 : pkg.commission_sale_value;
      const { data: sale } = await supabase.from('package_sales').insert([{ shop_id: shopId, customer_package_id: custPkg.id, seller_id: sellerId, amount_paid: pkg.sale_price, commission_amount: salesComm }]).select().single();
      await supabase.from('commission_logs').insert([{ shop_id: shopId, staff_id: sellerId, amount: salesComm, type: 'package_sale', reference_id: sale.id, note: `Bán gói: ${pkg.name}` }]);

      setCompletedInvoice({ ...inv, items: [{ name: pkg.name, price: pkg.sale_price }] });
      setCustomerPhone('');
      setPkgCustomerName('');
      setSelectedPkgId('');
    } catch (e: any) { alert('Lỗi: ' + e.message); }
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
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện trừ buổi');
    if (!selectedCustPkgId || !technicianId) return alert('Vui lòng chọn gói và KTV');
    setLoading(true);
    try {
      const cp = foundPackages.find(p => p.id === selectedCustPkgId);
      const svc = cp.packages.services;
      const unitPrice = cp.sale_price / cp.total_sessions;

      const comm = svc.commission_type === 'percent' ? (svc.price * svc.commission_value) / 100 : svc.commission_value;
      const { data: sess } = await supabase.from('service_sessions').insert([{ shop_id: shopId, service_id: svc.id, staff_id: technicianId, customer_package_id: cp.id, revenue_amount: unitPrice, commission_amount: comm }]).select().single();

      await supabase.from('customer_packages').update({ used_sessions: cp.used_sessions + 1, status: cp.used_sessions + 1 >= cp.total_sessions ? 'completed' : 'active' }).eq('id', cp.id);
      await supabase.from('revenue_logs').insert([{ shop_id: shopId, amount: unitPrice, type: 'package_session', reference_id: sess.id }]);
      await supabase.from('commission_logs').insert([{ shop_id: shopId, staff_id: technicianId, amount: comm, type: 'service_execution', reference_id: sess.id, note: `Dùng liệu trình: ${cp.packages.name}` }]);

      alert('Đã trừ 1 buổi thành công!');
      setSearchPhone('');
      setFoundPackages([]);
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    setLoading(false);
  };

  const handlePrint = () => {
    if (!hasPermission('invoice.print')) return alert('Bạn không có quyền in hoá đơn');
    window.print();
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 380px' }}>
      <div className="no-print">
        <div className="premium-card" style={{ marginBottom: '1.5rem', padding: '0.5rem' }}>
          <div style={{ display: 'flex' }}>
            <button onClick={() => setActiveTab('retail')} style={{ flex: 1, padding: '1rem', background: activeTab === 'retail' ? 'var(--primary)' : 'transparent', color: activeTab === 'retail' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Zap size={18} /> Bán lẻ
            </button>
            <button onClick={() => setActiveTab('sell_package')} style={{ flex: 1, padding: '1rem', background: activeTab === 'sell_package' ? 'var(--primary)' : 'transparent', color: activeTab === 'sell_package' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <PackageIcon size={18} /> Bán liệu trình
            </button>
            <button onClick={() => setActiveTab('use_package')} style={{ flex: 1, padding: '1rem', background: activeTab === 'use_package' ? 'var(--primary)' : 'transparent', color: activeTab === 'use_package' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Calendar size={18} /> Dùng liệu trình
            </button>
          </div>
        </div>

        {activeTab === 'retail' && (
          <div className="animate-fade">
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
            <h3 style={{ marginBottom: '1.5rem' }}>Thông tin bán gói</h3>
            <div className="grid" style={{ gap: '1.25rem' }}>
              <div><label className="form-label" style={{ fontWeight: '600' }}>SĐT Khách *</label><input type="tel" className="form-input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></div>
              <div><label className="form-label" style={{ fontWeight: '600' }}>Tên khách</label><input type="text" className="form-input" value={pkgCustomerName} onChange={e => setPkgCustomerName(e.target.value)} /></div>
              <div>
                <label className="form-label" style={{ fontWeight: '600' }}>Chọn gói</label>
                <select className="form-select" value={selectedPkgId} onChange={e => setSelectedPkgId(e.target.value)}>
                  <option value="">-- Chọn gói --</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name} ({Number(p.sale_price).toLocaleString()}đ)</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '600' }}>Người bán</label>
                <select className="form-select" value={sellerId} onChange={e => setSellerId(e.target.value)}>
                  <option value="">-- Chọn nhân viên --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <button 
                onClick={handleSellPackage} 
                disabled={loading || isRestricted()} 
                className="btn btn-primary" 
                style={{ width: '100%', height: '50px' }}
                title={isRestricted() ? 'Vui lòng gia hạn gói dịch vụ để thực hiện tính năng này' : ''}
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Xác nhận bán'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'use_package' && (
          <div className="animate-fade">
            <div className="premium-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="tel" className="form-input" placeholder="Tìm SĐT khách..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} />
                <button onClick={handleSearchPackage} className="btn btn-primary"><Search size={18} /></button>
              </div>
            </div>
            {foundPackages.length > 0 && (
              <div className="grid">
                {foundPackages.map(cp => (
                  <div key={cp.id} onClick={() => setSelectedCustPkgId(cp.id)} className="premium-card" style={{ border: selectedCustPkgId === cp.id ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><h4>{cp.packages.name}</h4><span className="badge badge-primary">Còn {cp.total_sessions - cp.used_sessions} buổi</span></div>
                  </div>
                ))}
                {selectedCustPkgId && (
                  <div className="premium-card" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                    <select className="form-select" value={technicianId} onChange={e => setTechnicianId(e.target.value)}><option value="">-- Kỹ thuật viên --</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                    <button onClick={handleUseSession} disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'var(--success)' }}>{loading ? <Loader2 className="animate-spin" /> : 'Xác nhận trừ buổi'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="no-print" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '1.5rem' }}>
        {completedInvoice ? (
          <div className="premium-card animate-fade" style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--success)', marginBottom: '1rem' }}><CheckCircle2 size={48} style={{ display: 'inline' }} /></div>
            <h3 style={{ marginBottom: '0.5rem' }}>Thanh toán thành công</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Hoá đơn #{completedInvoice.id.slice(0,8)}</p>
            <button onClick={handlePrint} className="btn btn-primary" style={{ width: '100%', marginBottom: '0.5rem' }}><Printer size={18} /> In hoá đơn</button>
            <button onClick={() => setCompletedInvoice(null)} className="btn" style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)' }}>Tiếp tục bán hàng</button>
          </div>
        ) : (
          <div className="premium-card" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Chi tiết đơn hàng</h3>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cart.map((item, idx) => (
                <div key={item.cartId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed var(--border)' }}>
                  <div style={{ fontSize: '0.875rem' }}>{item.name}</div>
                  <div style={{ fontWeight: '600' }}>{Number(item.price).toLocaleString()}đ</div>
                  <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <input type="text" className="form-input" placeholder="Tên khách lẻ..." style={{ marginBottom: '0.5rem' }} value={customerName} onChange={e => setRetailCustomerName(e.target.value)} />
                <select className="form-select" style={{ marginBottom: '0.5rem' }} value={retailStaffId} onChange={e => setRetailStaffId(e.target.value)}><option value="">-- Kỹ thuật viên --</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                {hasPermission('sale.discount') && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Giảm giá (đ)</label>
                    <input type="number" className="form-input" value={retailDiscount} onChange={e => setRetailDiscount(Number(e.target.value))} />
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', marginBottom: '1rem' }}><span>Tổng:</span><span style={{ color: 'var(--danger)' }}>{(cart.reduce((a, b) => a + Number(b.price), 0) - retailDiscount).toLocaleString()}đ</span></div>
                <button onClick={handleRetailCheckout} className="btn btn-primary" style={{ width: '100%' }}>THANH TOÁN</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GIAO DIỆN IN HOÁ ĐƠN (Chỉ hiển thị khi in) */}
      <div className="print-only" style={{ padding: '20px', fontFamily: 'monospace', width: '300px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>SPA & POS</h2>
          <p style={{ fontSize: '12px' }}>Hoá đơn thanh toán</p>
        </div>
        <div style={{ fontSize: '12px', borderBottom: '1px dashed black', paddingBottom: '10px', marginBottom: '10px' }}>
          <p>Mã: #{completedInvoice?.id.slice(0,8)}</p>
          <p>Khách: {completedInvoice?.customer_name}</p>
          <p>Ngày: {new Date().toLocaleString()}</p>
        </div>
        <div style={{ fontSize: '12px', borderBottom: '1px dashed black', paddingBottom: '10px', marginBottom: '10px' }}>
          {completedInvoice?.items.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{item.name}</span>
              <span>{Number(item.price).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'right', fontSize: '14px' }}>
          <p>Tạm tính: {Number(completedInvoice?.total_amount).toLocaleString()}đ</p>
          <p>Giảm giá: {Number(completedInvoice?.discount_amount).toLocaleString()}đ</p>
          <h3 style={{ margin: '5px 0' }}>TỔNG: {Number(completedInvoice?.final_amount).toLocaleString()}đ</h3>
        </div>
        <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '10px' }}>
          <p>Cảm ơn quý khách! Hẹn gặp lại.</p>
        </div>
      </div>

      <style>{`
        @media screen { .print-only { display: none; } }
        @media print {
          .no-print { display: none !important; }
          header, aside { display: none !important; }
          .print-only { display: block !important; margin: 0 auto; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
};

export default POS;
