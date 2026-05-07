import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<any>(null);
  const [previewInvoiceData, setPreviewInvoiceData] = useState<any>(null);

  // --- RETAIL STATE ---
  const [cart, setCart] = useState<any[]>([]);
  const [retailStaffId, setRetailStaffId] = useState('');
  const [retailDiscountType, setRetailDiscountType] = useState<'amount' | 'percent'>('amount');
  const [retailDiscountValue, setRetailDiscountValue] = useState(0);
  const [customerName, setRetailCustomerName] = useState('');
  const [retailCustomerId, setRetailCustomerId] = useState('');

  // --- SELL PACKAGE STATE ---
  const generateCardCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let code = '';
    for (let i = 0; i < 2; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 3; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    return code;
  };
  const [customerPhone, setCustomerPhone] = useState('');
  const [pkgCustomerName, setPkgCustomerName] = useState('');
  const [pkgCardCode, setPkgCardCode] = useState(generateCardCode());
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [pkgDiscountType, setPkgDiscountType] = useState<'amount' | 'percent'>('amount');
  const [pkgDiscountValue, setPkgDiscountValue] = useState(0);

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
    const [svc, pkg, stf, custs] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('packages').select('*, services(name)').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('staffs').select('*').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('customers').select('*').eq('shop_id', shopId).is('deleted_at', null)
    ]);
    setServices(svc.data || []);
    setPackages(pkg.data || []);
    setStaff(stf.data || []);
    setCustomersList(custs.data || []);
    setLoading(false);
  };

  const addToCart = (svc: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện bán hàng');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền tạo đơn hàng');
    setCart([...cart, { ...svc, cartId: Math.random() }]);
  };

  const handleRetailCheckoutClick = () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện thanh toán');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền thanh toán');
    if (cart.length === 0) return alert('Giỏ hàng trống');
    if (!retailStaffId) return alert('Vui lòng chọn nhân viên thực hiện');
    
    const subtotal = cart.reduce((acc, curr) => acc + Number(curr.price), 0);
    const discount = retailDiscountType === 'percent' 
      ? (subtotal * retailDiscountValue) / 100 
      : retailDiscountValue;
    const finalTotal = subtotal - discount;

    setPreviewInvoiceData({
      type: 'retail',
      items: cart.map(c => ({ name: c.name, price: c.price })),
      subtotal,
      discount,
      finalTotal,
      customerName: retailCustomerId ? customersList.find(c => c.id === retailCustomerId)?.name : (customerName || 'Khách lẻ'),
      customerId: retailCustomerId || null
    });
  };

  const handleSellPackageClick = () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện bán gói');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền thực hiện');
    if (!customerPhone || !selectedPkgId || !sellerId || !pkgCardCode) return alert('Vui lòng nhập đầy đủ SĐT, Mã thẻ, chọn gói và KTV bán');
    
    const pkg = packages.find(p => p.id === selectedPkgId);
    if (!pkg) return;

    const basePrice = pkg.sale_price;
    const additionalDiscount = pkgDiscountType === 'percent' ? (basePrice * pkgDiscountValue) / 100 : pkgDiscountValue;
    const finalSalePrice = basePrice - additionalDiscount;

    setPreviewInvoiceData({
      type: 'sell_package',
      items: [{ name: pkg.name, price: pkg.original_price }],
      subtotal: pkg.original_price,
      discount: pkg.original_price - finalSalePrice,
      finalTotal: finalSalePrice,
      customerName: pkgCustomerName || 'Khách lẻ',
      customerPhone: customerPhone,
      cardCode: pkgCardCode,
      selectedPkgId,
      sellerId,
      total_sessions: pkg.total_sessions,
      original_price: pkg.original_price,
      commission_sale_type: pkg.commission_sale_type,
      commission_sale_value: pkg.commission_sale_value,
      pkg_name: pkg.name
    });
  };

  const handleConfirmCheckout = async (print: boolean) => {
    if (!previewInvoiceData) return;
    setLoading(true);

    try {
      if (previewInvoiceData.type === 'retail') {
        const { subtotal, discount, finalTotal, customerName, customerId } = previewInvoiceData;

        // 1. Tạo Invoice chính
        const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
          shop_id: shopId,
          customer_id: customerId,
          customer_name: customerName,
          created_by: profile?.id,
          total_amount: subtotal,
          discount_amount: discount,
          final_amount: finalTotal,
          payment_method: 'cash',
          status: 'paid'
        }]).select().single();

        if (invErr) throw invErr;

        // 2. Tạo Invoice Items & Sessions & Logs
        for (const item of cart) {
          const { error: itemErr } = await supabase.from('invoice_items').insert([{
            invoice_id: inv.id,
            type: 'service',
            service_id: item.id,
            staff_id: retailStaffId || profile?.id || null,
            unit_price: item.price,
            final_price: item.price,
            price: item.price
          }]);
          if (itemErr) throw new Error(`Lỗi lưu dịch vụ lẻ: ${itemErr.message}`);

          const comm = item.commission_type === 'percent' ? (item.price * item.commission_value) / 100 : item.commission_value;
          const { data: sess } = await supabase.from('service_sessions').insert([{
            shop_id: shopId,
            service_id: item.id,
            staff_id: retailStaffId,
            revenue_amount: item.price,
            commission_amount: comm,
            status: 'completed'
          }]).select().single();

          await supabase.from('commission_logs').insert([{ shop_id: shopId, staff_id: retailStaffId, amount: comm, type: 'service_execution', service_session_id: sess.id, note: `Dịch vụ lẻ: ${item.name}` }]);
        }
        
        // Chỉ lưu 1 revenue_log tổng cho cả hoá đơn bán lẻ
        await supabase.from('revenue_logs').insert([{ shop_id: shopId, amount: finalTotal, type: 'retail', invoice_id: inv.id }]);

        setCompletedInvoice({
          id: inv.id,
          created_at: inv.created_at,
          customer_name: customerName || 'Khách lẻ',
          items: cart,
          total_amount: subtotal,
          discount_amount: discount,
          final_amount: finalTotal,
          staff_name: staff.find(s => s.id === retailStaffId)?.full_name || profile?.full_name || 'Thu ngân'
        });
        setCart([]);
        setRetailDiscountValue(0);
        setRetailCustomerName('');
        setRetailCustomerId('');
      } else if (previewInvoiceData.type === 'sell_package') {
        const { subtotal, discount, finalTotal, customerName, customerPhone, cardCode, selectedPkgId, sellerId, total_sessions, original_price, commission_sale_type, commission_sale_value, pkg_name } = previewInvoiceData;
        
        const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
          shop_id: shopId,
          customer_name: customerName,
          customer_phone: customerPhone,
          created_by: profile?.id,
          total_amount: subtotal,
          discount_amount: discount,
          final_amount: finalTotal,
          status: 'paid'
        }]).select().single();
        if (invErr) throw new Error(`Lỗi tạo hoá đơn: ${invErr.message}`);

        const { data: custPkg, error: cpErr } = await supabase.from('customer_packages').insert([{
          shop_id: shopId,
          package_id: selectedPkgId,
          customer_name: customerName,
          customer_phone: customerPhone,
          card_code: cardCode,
          total_sessions: total_sessions,
          used_sessions: 0,
          sale_price: finalTotal,
          status: 'active'
        }]).select().single();
        if (cpErr || !custPkg) throw new Error(`Lỗi tạo dữ liệu liệu trình: ${cpErr?.message || 'Không có dữ liệu'}`);

        const { error: itemErr } = await supabase.from('invoice_items').insert([{
          invoice_id: inv.id,
          type: 'package_sale',
          package_id: selectedPkgId,
          staff_id: sellerId || profile?.id || null,
          unit_price: original_price,
          final_price: finalTotal,
          price: finalTotal
        }]);
        if (itemErr) throw new Error(`Lỗi lưu dịch vụ gói: ${itemErr.message}`);

        const salesComm = commission_sale_type === 'percent' ? (finalTotal * commission_sale_value) / 100 : commission_sale_value;
        const validSellerId = sellerId || profile?.id || null;

        const { data: sale, error: saleErr } = await supabase.from('package_sales').insert([{ 
          shop_id: shopId, 
          invoice_id: inv.id,
          customer_package_id: custPkg.id, 
          seller_id: validSellerId, 
          amount_paid: finalTotal, 
          commission_amount: salesComm 
        }]).select().single();
        if (saleErr || !sale) throw new Error(`Lỗi tạo giao dịch bán gói: ${saleErr?.message || 'Không có dữ liệu'}`);

        await supabase.from('commission_logs').insert([{ shop_id: shopId, staff_id: validSellerId, amount: salesComm, type: 'package_sale', package_sale_id: sale.id, note: `Bán gói: ${pkg_name}` }]);
        await supabase.from('revenue_logs').insert([{ shop_id: shopId, amount: finalTotal, type: 'package_sale', package_sale_id: sale.id }]);

        setCompletedInvoice({ 
          ...inv, 
          items: [{ name: pkg_name, price: original_price }],
          staff_name: staff.find(s => s.id === sellerId)?.full_name || profile?.full_name || 'Thu ngân'
        });
        setCustomerPhone('');
        setPkgCustomerName('');
        setPkgCardCode(generateCardCode());
        setSelectedPkgId('');
        setPkgDiscountValue(0);
      } else if (previewInvoiceData.type === 'use_package') {
        const { cp, technicianId, customerName, customerPhone, cardCode, items, total_sessions, used_sessions } = previewInvoiceData;
        const svc = cp.packages.services;
        const unitPrice = cp.sale_price / cp.total_sessions;

        const comm = svc.commission_type === 'percent' ? (svc.price * svc.commission_value) / 100 : svc.commission_value;
        const { data: sess, error: sessErr } = await supabase.from('service_sessions').insert([{ shop_id: shopId, service_id: svc.id, staff_id: technicianId, customer_package_id: cp.id, revenue_amount: unitPrice, commission_amount: comm }]).select().single();
        if (sessErr || !sess) throw new Error(`Lỗi trừ buổi: ${sessErr?.message || ''}`);

        await supabase.from('customer_packages').update({ used_sessions: cp.used_sessions + 1, status: cp.used_sessions + 1 >= cp.total_sessions ? 'completed' : 'active' }).eq('id', cp.id);
        await supabase.from('revenue_logs').insert([{ shop_id: shopId, amount: unitPrice, type: 'package_session', service_session_id: sess.id }]);
        await supabase.from('commission_logs').insert([{ shop_id: shopId, staff_id: technicianId, amount: comm, type: 'service_execution', service_session_id: sess.id, note: `Dùng liệu trình: ${cp.packages.name}` }]);

        setCompletedInvoice({
          id: sess.id,
          created_at: new Date().toISOString(),
          customer_name: customerName,
          customer_phone: customerPhone,
          card_code: cardCode,
          is_use_package: true,
          used_sessions: used_sessions + 1,
          total_sessions: total_sessions,
          items: items,
          staff_name: staff.find(s => s.id === technicianId)?.full_name || profile?.full_name || 'KTV'
        });

        setSearchPhone('');
        setFoundPackages([]);
        setSelectedCustPkgId('');
      }
      
      setPreviewInvoiceData(null);
      if (print) {
        setTimeout(() => {
          window.print();
        }, 500);
      }
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    setLoading(false);
  };

  const handleSearchPackage = async () => {
    if (!searchPhone) return;
    setLoading(true);
    const { data: cpData, error } = await supabase
      .from('customer_packages')
      .select('*')
      .eq('shop_id', shopId)
      .or(`customer_phone.ilike.%${searchPhone}%,customer_name.ilike.%${searchPhone}%,card_code.ilike.%${searchPhone}%`)
      .eq('status', 'active');

    if (error) {
      console.error('Lỗi tìm kiếm gói:', error);
      alert('Lỗi tìm kiếm gói: ' + error.message);
      setLoading(false);
      return;
    }

    if (cpData && cpData.length > 0) {
      const packageIds = [...new Set(cpData.map(cp => cp.package_id).filter(Boolean))];
      let packagesData: any[] = [];
      if (packageIds.length > 0) {
        const { data: pkgs } = await supabase.from('packages')
          .select('id, name, service_id, services(*)')
          .in('id', packageIds);
        if (pkgs) packagesData = pkgs;
      }

      const finalData = cpData.map(cp => ({
        ...cp,
        packages: packagesData.find(p => p.id === cp.package_id) || { name: 'Gói không xác định' }
      }));
      setFoundPackages(finalData);
    } else {
      setFoundPackages([]);
    }
    
    setLoading(false);
  };

  const handleUseSessionClick = () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện trừ buổi');
    if (!selectedCustPkgId || !technicianId) return alert('Vui lòng chọn gói và KTV');
    
    const cp = foundPackages.find(p => p.id === selectedCustPkgId);
    if (!cp) return;

    const maskInfo = (str: string) => str ? '*'.repeat(Math.max(0, str.length - 2)) + str.slice(-2) : '';

    setPreviewInvoiceData({
      type: 'use_package',
      cp,
      technicianId,
      customerName: cp.customer_name || 'Khách lẻ',
      customerPhone: maskInfo(cp.customer_phone),
      cardCode: maskInfo(cp.card_code),
      total_sessions: cp.total_sessions,
      used_sessions: cp.used_sessions,
      items: [{ name: `Dùng 1 buổi: ${cp.packages?.name}`, price: '-' }]
    });
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
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>Tên khách</label>
                  <input type="text" className="form-input" value={pkgCustomerName} onChange={e => setPkgCustomerName(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>SĐT Khách *</label>
                  <input type="tel" className="form-input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '600' }}>Mã thẻ liệu trình *</label>
                <input type="text" className="form-input" value={pkgCardCode} onChange={e => setPkgCardCode(e.target.value)} />
              </div>
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
              {hasPermission('sale.discount') && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontWeight: '600' }}>Giảm giá thêm</label>
                    <input type="number" className="form-input" value={pkgDiscountValue} onChange={e => setPkgDiscountValue(Number(e.target.value))} />
                  </div>
                  <div style={{ width: '100px' }}>
                    <label className="form-label" style={{ fontWeight: '600' }}>Loại</label>
                    <select className="form-select" value={pkgDiscountType} onChange={e => setPkgDiscountType(e.target.value as any)}>
                      <option value="amount">VNĐ</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </div>
              )}
              <button 
                onClick={handleSellPackageClick} 
                disabled={isRestricted()} 
                className="btn btn-primary" 
                style={{ width: '100%', height: '50px' }}
                title={isRestricted() ? 'Vui lòng gia hạn gói dịch vụ để thực hiện tính năng này' : ''}
              >
                Xác nhận thanh toán gói
              </button>
            </div>
          </div>
        )}

        {activeTab === 'use_package' && (
          <div className="animate-fade">
            <div className="premium-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Tìm thẻ liệu trình</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" className="form-input" placeholder="Nhập SĐT, Tên hoặc Mã Thẻ..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchPackage()} />
                <button onClick={handleSearchPackage} className="btn btn-primary"><Search size={18} /></button>
              </div>
            </div>
            {foundPackages.length > 0 && (
              <div className="grid">
                {foundPackages.map(cp => (
                  <div key={cp.id} onClick={() => setSelectedCustPkgId(cp.id)} className="premium-card" style={{ border: selectedCustPkgId === cp.id ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: '600', color: 'var(--primary)' }}>{cp.packages?.name}</div>
                      <span className="badge badge-primary">Còn {cp.total_sessions - cp.used_sessions} buổi</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                      Khách: {cp.customer_name || 'Khách lẻ'} - SĐT: {cp.customer_phone}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Mã thẻ: <strong>{cp.card_code || 'Không có'}</strong>
                    </div>
                  </div>
                ))}
                {selectedCustPkgId && (
                  <div className="premium-card" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                    <select className="form-select" value={technicianId} onChange={e => setTechnicianId(e.target.value)}><option value="">-- Kỹ thuật viên --</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                    <button onClick={handleUseSessionClick} disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'var(--success)' }}>{loading ? <Loader2 className="animate-spin" /> : 'Xác nhận trừ buổi'}</button>
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
                <select className="form-select" style={{ marginBottom: '0.5rem' }} value={retailCustomerId} onChange={e => { setRetailCustomerId(e.target.value); setRetailCustomerName(''); }}>
                  <option value="">Khách vãng lai (Nhập tên)</option>
                  {customersList.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `- ${c.phone}` : ''}</option>)}
                </select>
                {!retailCustomerId && (
                  <input type="text" className="form-input" placeholder="Tên khách lẻ..." style={{ marginBottom: '0.5rem' }} value={customerName} onChange={e => setRetailCustomerName(e.target.value)} />
                )}
                <select className="form-select" style={{ marginBottom: '0.5rem' }} value={retailStaffId} onChange={e => setRetailStaffId(e.target.value)}><option value="">-- Kỹ thuật viên --</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                {hasPermission('sale.discount') && (
                  <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Giảm giá</label>
                      <input type="number" className="form-input" value={retailDiscountValue} onChange={e => setRetailDiscountValue(Number(e.target.value))} />
                    </div>
                    <div style={{ width: '100px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Loại</label>
                      <select className="form-select" value={retailDiscountType} onChange={e => setRetailDiscountType(e.target.value as any)}>
                        <option value="amount">VNĐ</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', marginBottom: '1rem' }}>
                  <span>Tổng:</span>
                  <span style={{ color: 'var(--danger)' }}>
                    {(() => {
                      const subtotal = cart.reduce((a, b) => a + Number(b.price), 0);
                      const discount = retailDiscountType === 'percent' ? (subtotal * retailDiscountValue) / 100 : retailDiscountValue;
                      return (subtotal - discount).toLocaleString();
                    })()}đ
                  </span>
                </div>
                <button onClick={handleRetailCheckoutClick} className="btn btn-primary" style={{ width: '100%' }}>THANH TOÁN</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GIAO DIỆN IN HOÁ ĐƠN (Chỉ hiển thị khi in) */}
      <div className="print-only" style={{ padding: '20px', fontFamily: 'monospace', width: '300px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>SPA & POS</h2>
          <p style={{ fontSize: '12px' }}>{completedInvoice?.is_use_package ? 'BIÊN NHẬN DÙNG LIỆU TRÌNH' : 'HOÁ ĐƠN THANH TOÁN'}</p>
        </div>
        <div style={{ fontSize: '12px', borderBottom: '1px dashed black', paddingBottom: '10px', marginBottom: '10px' }}>
          <p>Mã: #{completedInvoice?.id.slice(0,8)}</p>
          <p>Khách: {completedInvoice?.customer_name}</p>
          {completedInvoice?.customer_phone && <p>SĐT: {completedInvoice.customer_phone}</p>}
          {completedInvoice?.card_code && <p>Mã thẻ: {completedInvoice.card_code}</p>}
          <p>Nhân viên: {completedInvoice?.staff_name}</p>
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
        
        {completedInvoice?.is_use_package ? (
          <div style={{ textAlign: 'right', fontSize: '14px' }}>
            <p>Tổng số buổi gói: {completedInvoice?.total_sessions}</p>
            <p>Đã dùng (Bao gồm lần này): {completedInvoice?.used_sessions}</p>
            <h3 style={{ margin: '10px 0', fontSize: '16px' }}>
              CÒN LẠI: {completedInvoice?.total_sessions - completedInvoice?.used_sessions} buổi
            </h3>
          </div>
        ) : (
          <div style={{ textAlign: 'right', fontSize: '14px' }}>
            <p>Tạm tính: {Number(completedInvoice?.total_amount).toLocaleString()}đ</p>
            <p>Giảm giá: {Number(completedInvoice?.discount_amount).toLocaleString()}đ</p>
            <h3 style={{ margin: '5px 0' }}>TỔNG: {Number(completedInvoice?.final_amount).toLocaleString()}đ</h3>
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '10px' }}>
          <p>Cảm ơn quý khách! Hẹn gặp lại.</p>
        </div>
      </div>

      {/* Modal Preview Hóa Đơn */}
      {previewInvoiceData && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.25rem' }}>Xác nhận Hoá đơn</h3>
            
            <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
                <span style={{ fontWeight: '600' }}>{previewInvoiceData.customerName}</span>
              </div>
              {previewInvoiceData.customerPhone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>SĐT:</span>
                  <span style={{ fontWeight: '600' }}>{previewInvoiceData.customerPhone}</span>
                </div>
              )}
              {previewInvoiceData.cardCode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Mã thẻ:</span>
                  <span style={{ fontWeight: '600' }}>{previewInvoiceData.cardCode}</span>
                </div>
              )}
              
              <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
              
              {previewInvoiceData.items.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>{item.name}</span>
                  <span>{item.price === '-' ? '-' : `${Number(item.price).toLocaleString()}đ`}</span>
                </div>
              ))}
              
              <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
              
              {previewInvoiceData.type === 'use_package' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tổng số buổi gói:</span>
                    <span style={{ fontWeight: '600' }}>{previewInvoiceData.total_sessions}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Đã dùng (Bao gồm lần này):</span>
                    <span style={{ fontWeight: '600' }}>{previewInvoiceData.used_sessions + 1}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                    <span>CÒN LẠI:</span>
                    <span>{previewInvoiceData.total_sessions - (previewInvoiceData.used_sessions + 1)} buổi</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tạm tính:</span>
                    <span>{Number(previewInvoiceData.subtotal).toLocaleString()}đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Giảm giá:</span>
                    <span>{Number(previewInvoiceData.discount).toLocaleString()}đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                    <span>TỔNG CỘNG:</span>
                    <span>{Number(previewInvoiceData.finalTotal).toLocaleString()}đ</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => handleConfirmCheckout(true)} 
                disabled={loading} 
                className="btn btn-primary" 
                style={{ width: '100%' }}
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Xác nhận & In hoá đơn'}
              </button>
              <button 
                onClick={() => handleConfirmCheckout(false)} 
                disabled={loading} 
                className="btn" 
                style={{ width: '100%', background: 'var(--success)', color: 'white', border: 'none' }}
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Chỉ xác nhận (Không in)'}
              </button>
              <button 
                onClick={() => setPreviewInvoiceData(null)} 
                disabled={loading} 
                className="btn" 
                style={{ width: '100%', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
