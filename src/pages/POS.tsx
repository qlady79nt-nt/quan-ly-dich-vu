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
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import '../receipt.css';

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
  const [customerName, setRetailCustomerName] = useState('');
  const [retailCustomerId, setRetailCustomerId] = useState('');
  const [retailBedId, setRetailBedId] = useState('');
  const [bedsList, setBedsList] = useState<any[]>([]);

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
  const [packageBedId, setPackageBedId] = useState('');

  useEffect(() => {
    if (shopId) fetchData();
    // Setup afterprint listener
    const handleAfterPrint = () => {
      setCompletedInvoice(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [shopId, profile]);

  const fetchData = async () => {
    setLoading(true);
    const [svc, pkg, stf, custs, bds, activeSessionsRes] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('packages').select('*, services(name)').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('staffs').select('*').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('customers').select('*').eq('shop_id', shopId).is('deleted_at', null),
      supabase.from('beds').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('service_sessions').select('bed_id').eq('shop_id', shopId).eq('status', 'in_progress')
    ]);
    setServices(svc.data || []);
    setPackages(pkg.data || []);
    setStaff(stf.data || []);
    setCustomersList(custs.data || []);

    const allBeds = bds.data || [];
    const activeBedIds = (activeSessionsRes.data || []).map(s => s.bed_id);
    setBedsList(allBeds.filter(b => !activeBedIds.includes(b.id)));
    setLoading(false);
  };

  const addToCart = (svc: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện bán hàng');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền tạo đơn hàng');
    setCart([{ ...svc, cartId: Math.random() }]); // Chỉ cho phép 1 dịch vụ 1 lần
  };

  const handleRetailCheckoutClick = async () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện thanh toán');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền thanh toán');
    if (cart.length === 0) return alert('Giỏ hàng trống');
    if (!retailStaffId) return alert('Vui lòng chọn Kỹ thuật viên (Bắt buộc)');
    if (!retailBedId) return alert('Vui lòng chọn Chỗ (Bắt buộc)');

    setLoading(true);
    const item = cart[0];
    const customer = retailCustomerId ? customersList.find(c => c.id === retailCustomerId) : null;
    const finalCustName = customer?.name || customerName || 'Khách lẻ';
    const finalCustPhone = customer?.phone || '';

    const { error } = await supabase.from('service_sessions').insert([{
      shop_id: shopId,
      service_id: item.id,
      staff_id: retailStaffId,
      bed_id: retailBedId,
      status: 'in_progress',
      is_retail: true,
      retail_customer_name: finalCustName,
      retail_customer_phone: finalCustPhone
    }]);

    if (error) {
      if (error.code === '23505') {
        alert('Chỗ này vừa được người khác xếp! Vui lòng chọn chỗ khác.');
      } else {
        alert('Lỗi tạo cuốc dịch vụ: ' + error.message);
      }
      setLoading(false);
      return;
    }

    setCart([]);
    setRetailBedId('');
    setRetailStaffId('');
    setRetailCustomerName('');
    setRetailCustomerId('');

    // Load lại list chỗ bằng cách tính toán động
    const [newBedsRes, newSessionsRes] = await Promise.all([
      supabase.from('beds').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('service_sessions').select('bed_id').eq('shop_id', shopId).eq('status', 'in_progress')
    ]);
    const activeIds = (newSessionsRes.data || []).map(s => s.bed_id);
    setBedsList((newBedsRes.data || []).filter(b => !activeIds.includes(b.id)));
    setPackageBedId('');

    alert('Đã xếp khách vào chỗ thành công! Chuyển sang tab Chỗ để theo dõi và thanh toán.');
    setLoading(false);
  };

  const handleSellPackageClick = () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện bán gói');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền thực hiện');
    if (!customerPhone || !selectedPkgId) return alert('Vui lòng nhập đầy đủ SĐT và chọn gói');
    if (!sellerId) {
      if (!window.confirm("⚠️ Chưa chọn người bán!\n\nGiao dịch này sẽ KHÔNG được tính hoa hồng cho bất kỳ ai.\nBạn có chắc chắn muốn tiếp tục thanh toán?")) return;
    }

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
      pkg_sale_price: basePrice,
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
        // Tính năng này đã chuyển sang Beds.tsx (Thanh toán sau khi làm xong)
        // Đoạn code này được giữ lại để phòng hờ, nhưng hiện tại POS không gọi setPreviewInvoiceData('retail') nữa.
      } else if (previewInvoiceData.type === 'sell_package') {
        const { subtotal, discount, finalTotal, customerName, customerPhone, cardCode, selectedPkgId, sellerId, total_sessions, original_price, pkg_sale_price, commission_sale_type, commission_sale_value, pkg_name } = previewInvoiceData;

        const invCode = `HD${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000).toString()}`;

        const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
          shop_id: shopId,
          invoice_code: invCode,
          customer_name: customerName,
          customer_phone: customerPhone,
          created_by: profile?.id,
          total_amount: subtotal,
          discount_amount: discount,
          final_amount: finalTotal,
          status: 'paid'
        }]).select().single();
        if (invErr) throw new Error(`Lỗi tạo hoá đơn: ${invErr.message}`);

        const finalCardCode = 'P' + Math.floor(Math.random() * 100).toString().padStart(2, '0') + invCode;

        const { data: custPkg, error: cpErr } = await supabase.from('customer_packages').insert([{
          shop_id: shopId,
          package_id: selectedPkgId,
          customer_name: customerName,
          customer_phone: customerPhone,
          card_code: finalCardCode,
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
          staff_id: sellerId || null,
          unit_price: original_price,
          final_price: finalTotal,
          price: finalTotal
        }]);
        if (itemErr) throw new Error(`Lỗi lưu dịch vụ gói: ${itemErr.message}`);

        const salesComm = commission_sale_type === 'percent' ? (pkg_sale_price * commission_sale_value) / 100 : commission_sale_value;
        const validSellerId = sellerId || null;

        const { data: sale, error: saleErr } = await supabase.from('package_sales').insert([{
          shop_id: shopId,
          invoice_id: inv.id,
          customer_package_id: custPkg.id,
          seller_id: validSellerId,
          amount_paid: finalTotal,
          commission_amount: salesComm
        }]).select().single();
        if (saleErr || !sale) throw new Error(`Lỗi tạo giao dịch bán gói: ${saleErr?.message || 'Không có dữ liệu'}`);

        const { error: commLogErr } = await supabase.from('commission_logs').insert([{ shop_id: shopId, staff_id: validSellerId, amount: salesComm, type: 'package_sale', package_sale_id: sale.id, note: `Bán gói: ${pkg_name}` }]);
        if (commLogErr) throw new Error(`Lỗi lưu hoa hồng bán gói: ${commLogErr.message}`);
        const { error: revLogErr } = await supabase.from('revenue_logs').insert([{ shop_id: shopId, amount: finalTotal, type: 'package_sale', package_sale_id: sale.id }]);
        if (revLogErr) throw new Error(`Lỗi lưu doanh thu bán gói: ${revLogErr.message}`);

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
        const { cp, technicianId, bedId } = previewInvoiceData;
        const svc = cp.packages.services;

        const { data: sess, error: sessErr } = await supabase.from('service_sessions').insert([{ 
          shop_id: shopId, 
          service_id: svc.id, 
          staff_id: technicianId, 
          customer_package_id: cp.id,
          bed_id: bedId,
          status: 'in_progress',
          is_retail: false
        }]).select().single();
        if (sessErr || !sess) throw new Error(`Lỗi xếp chỗ trừ buổi: ${sessErr?.message || ''}`);

        alert('Đã xếp khách vào chỗ thành công! Vui lòng sang tab Chỗ để theo dõi và hoàn thành trừ buổi.');
        
        // Refresh Beds List
        const [newBedsRes, newSessionsRes] = await Promise.all([
          supabase.from('beds').select('*').eq('shop_id', shopId).order('name'),
          supabase.from('service_sessions').select('bed_id').eq('shop_id', shopId).eq('status', 'in_progress')
        ]);
        const activeIds = (newSessionsRes.data || []).map(s => s.bed_id);
        setBedsList((newBedsRes.data || []).filter(b => !activeIds.includes(b.id)));

        setSearchPhone('');
        setFoundPackages([]);
        setSelectedCustPkgId('');
        setTechnicianId('');
        setPackageBedId('');
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
    if (!selectedCustPkgId) return alert('Vui lòng chọn thẻ liệu trình');
    if (!technicianId) return alert('Vui lòng chọn Kỹ thuật viên (Bắt buộc đối với nghiệp vụ trừ buổi)');
    if (!packageBedId) return alert('Vui lòng chọn Chỗ (Bắt buộc)');

    const cp = foundPackages.find(p => p.id === selectedCustPkgId);
    if (!cp) return;

    const maskInfo = (str: string) => str ? '*'.repeat(Math.max(0, str.length - 2)) + str.slice(-2) : '';

    setPreviewInvoiceData({
      type: 'use_package',
      cp,
      technicianId,
      bedId: packageBedId,
      customerName: cp.customer_name || 'Khách lẻ',
      customerPhone: maskInfo(cp.customer_phone),
      cardCode: maskInfo(cp.card_code),
      total_sessions: cp.total_sessions,
      used_sessions: cp.used_sessions,
      items: [{ name: `Dùng 1 buổi: ${cp.packages?.name}`, price: '-' }]
    });
  };

  const handlePrint = () => {
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
                <label className="form-label" style={{ fontWeight: '600' }}>Mã thẻ liệu trình</label>
                <input type="text" className="form-input" disabled value="Hệ thống tự động tạo mã P..." style={{ background: 'var(--bg-main)', color: 'var(--text-light)' }} />
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
                    <select className="form-select" style={{ marginBottom: '0.5rem' }} value={technicianId} onChange={e => setTechnicianId(e.target.value)}><option value="">-- Kỹ thuật viên --</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                    <select className="form-select" value={packageBedId} onChange={e => setPackageBedId(e.target.value)}><option value="">-- Chọn Chỗ (Trống) --</option>{bedsList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                    <button onClick={handleUseSessionClick} disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'var(--success)' }}>{loading ? <Loader2 className="animate-spin" /> : 'Bắt đầu & Xếp chỗ'}</button>
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
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Hoá đơn #{completedInvoice.id.slice(0, 8)}</p>
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
                <select className="form-select" style={{ marginBottom: '0.5rem' }} value={retailStaffId} onChange={e => setRetailStaffId(e.target.value)}>
                  <option value="">-- Kỹ thuật viên (Bắt buộc) --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <select className="form-select" style={{ marginBottom: '0.5rem' }} value={retailBedId} onChange={e => setRetailBedId(e.target.value)}>
                  <option value="">-- Chọn Chỗ (Trống) --</option>
                  {bedsList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', marginBottom: '1rem', marginTop: '1rem' }}>
                  <span>Phí dịch vụ (tạm tính):</span>
                  <span style={{ color: 'var(--primary)' }}>
                    {cart.reduce((a, b) => a + Number(b.price), 0).toLocaleString()}đ
                  </span>
                </div>
                <button onClick={handleRetailCheckoutClick} disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                  {loading ? <Loader2 className="animate-spin" /> : 'BẮT ĐẦU DỊCH VỤ & XẾP CHỖ'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GIAO DIỆN IN HOÁ ĐƠN TẬP TRUNG */}
      <ReceiptTemplate
        invoice={completedInvoice}
        config={{
          shop_name: 'SPA & POS', // Tương lai lấy từ db: profile.shop_settings.shop_name
          paper_size: '80mm', // Tương lai lấy từ db: profile.shop_settings.paper_size
          footer_message: 'Cảm ơn quý khách! Hẹn gặp lại.'
        }}
      />

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
                {loading ? <Loader2 className="animate-spin" /> : previewInvoiceData.type === 'use_package' ? 'Xác nhận trừ buổi (Không in)' : 'Xác nhận & In hoá đơn'}
              </button>
              {previewInvoiceData.type !== 'use_package' && (
                <button
                  onClick={() => handleConfirmCheckout(false)}
                  disabled={loading}
                  className="btn"
                  style={{ width: '100%', background: 'var(--success)', color: 'white', border: 'none' }}
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Chỉ xác nhận (Không in)'}
                </button>
              )}
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
    </div>
  );
};

export default POS;
