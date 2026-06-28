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
  CheckCircle2,
  ShoppingCart,
  Folder,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import { PrintContainer } from '../components/PrintContainer';
import { getPrintSettings } from '../lib/printSettings';
import type { ShopPrintSettings } from '../lib/printSettings';
import {
  logPrintEvent,
  captureBeforePrint,
  captureAfterPrint,
  captureComponentTree,
  captureDOM
} from '../lib/printDebugger';
import '../receipt.css';

const DebugReceiptTemplate = (props: any) => {
  console.log({
    role: props.profile?.role,
    invoice: props.invoice,
    config: props.config,
    props
  });
  console.trace("ReceiptTemplate render");
  logPrintEvent('ReceiptTemplate render');
  return <ReceiptTemplate {...props} />;
};

const DebugPrintContainer = (props: any) => {
  logPrintEvent('PrintContainer render');
  return <PrintContainer {...props} />;
};

const POS = () => {
  const { profile, hasPermission, isRestricted } = useAuth();
  const shopId = profile?.shop_id;

  const [activeTab, setActiveTab] = useState<'retail' | 'sell_package' | 'use_package' | 'combo'>('retail');
  const [services, setServices] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [posViewMode, setPosViewMode] = useState<'all' | 'groups'>('all');
  const [packages, setPackages] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [completedInvoice, setCompletedInvoiceActual] = useState<any>(null);
  const setCompletedInvoice = (val: any) => {
    console.trace("setCompletedInvoice", val);
    setCompletedInvoiceActual(val);
  };
  const [previewInvoiceData, setPreviewInvoiceData] = useState<any>(null);
  const [isPrinting, setIsPrintingActual] = useState(false);
  const setIsPrinting = (val: boolean | ((prev: boolean) => boolean)) => {
    console.trace("setIsPrinting", val);
    setIsPrintingActual(val);
  };

  // --- RETAIL STATE ---
  const [cart, setCart] = useState<any[]>([]);
  const [retailSearchTerm, setRetailSearchTerm] = useState('');
  const [retailStaffId, setRetailStaffId] = useState('');
  const [customerName, setRetailCustomerName] = useState('');
  const [retailCustomerId, setRetailCustomerId] = useState('');
  const [retailBedId, setRetailBedId] = useState('');
  const [bedsList, setBedsList] = useState<any[]>([]);
  const [printSettings, setPrintSettings] = useState<ShopPrintSettings | undefined>(undefined);

  // --- SELL PACKAGE STATE ---
  const generateCardCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let code = '';
    for (let i = 0; i < 2; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 3; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    return code;
  };

  // --- COMBO STATE ---
  const [comboCart, setComboCart] = useState<any[]>([]);
  const [comboSearchTerm, setComboSearchTerm] = useState('');
  const [comboCustomerName, setComboCustomerName] = useState('');
  const [comboCustomerId, setComboCustomerId] = useState('');
  const [comboBedId, setComboBedId] = useState('');
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

  // --- MOBILE RESPONSIVE STATE ---
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [showMobileCart, setShowMobileCart] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Bỏ logic tự reset mobileStep vì đã dùng kiến trúc mới
  const [selectedCustPkgId, setSelectedCustPkgId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [packageBedId, setPackageBedId] = useState('');

  useEffect(() => {
    console.log('FETCH RUN - useEffect triggered');
    if (shopId) fetchData();
    // Setup afterprint listener (nếu cần, nhưng PrintContainer đã handle)
    const handleAfterPrint = () => {
      logPrintEvent('handleAfterPrint');
      // Bỏ setCompletedInvoice(null) ở đây để người dùng vẫn thấy màn hình "Thành công"
      setIsPrinting(false);
      // Wait a tick for DOM to update after printing state changes
      const stillExists = document.querySelectorAll('.receipt-container').length;
      console.log(`[DOM SAU AFTERPRINT] Số lượng .receipt-container còn lại trong DOM: ${stillExists}`);
      if (stillExists > 0) {
        console.log(`⚠️ CẢNH BÁO: ReceiptTemplate VẪN CÒN TỒN TẠI TRONG DOM SAU KHI IN!`);
      }
      setTimeout(() => captureAfterPrint(completedInvoice, isPrinting), 100);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    const originalPrint = window.print;
    window.print = function(...args) {
      logPrintEvent('window.print called');
      captureBeforePrint(profile);
      return originalPrint.apply(window, args);
    };

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      window.print = originalPrint;
    };
  }, [shopId, profile, completedInvoice, isPrinting]);

  const fetchData = async () => {
    console.log('fetchData execution started...');
    setLoading(true);
    
    const [svc, pkg, stf, custs, bds, activeSessionsRes, grps] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('packages').select('*, services(name)').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('staffs').select('*').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active'),
      supabase.from('customers').select('*').eq('shop_id', shopId).is('deleted_at', null),
      supabase.from('beds').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('service_sessions').select('bed_id').eq('shop_id', shopId).eq('status', 'in_progress'),
      supabase.from('service_groups').select('*').eq('shop_id', shopId).order('sort_order', { ascending: true })
    ]);
    
    const settings = await getPrintSettings(shopId || '');
    setPrintSettings(settings);
    
    console.log('SERVICES DEBUG:', {
      shopId,
      data: svc.data,
      error: svc.error
    });

    setServices(svc.data || []);
    setGroups(grps.data || []);
    setPackages(pkg.data || []);
    
    const staffData = stf.data || [];
    staffData.sort((a, b) => {
      const getWeight = (pos: string) => {
        if (pos === 'technician' || pos === 'staff') return 1;
        if (pos === 'tour') return 2;
        if (pos === 'manager') return 3;
        if (pos === 'receptionist') return 4;
        if (pos === 'collaborator') return 5;
        return 6;
      };
      return getWeight(a.position) - getWeight(b.position);
    });
    setStaff(staffData);
    
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
    if (isMobile) {
      setShowMobileCart(true);
    }
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
      service_price: item.price,
      discount_type: item.discountType || 'amount',
      discount_value: item.discountValue || 0,
      status: 'in_progress',
      is_retail: true,
      retail_customer_name: finalCustName,
      retail_customer_phone: finalCustPhone,
      session_code: 'S' + new Date().getDate().toString().padStart(2, '0') + (new Date().getMonth() + 1).toString().padStart(2, '0') + Math.floor(1000 + Math.random() * 9000).toString()
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

  const addToComboCart = (svc: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện bán hàng');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền tạo đơn hàng');
    if (comboCart.length >= 5) return alert('Chỉ được chọn tối đa 5 dịch vụ trong 1 Combo');
    setComboCart([...comboCart, { ...svc, cartId: Math.random(), staff_id: '' }]);
    if (isMobile) {
      setShowMobileCart(true);
    }
  };

  const updateComboCartStaff = (cartId: number, staffId: string) => {
    setComboCart(comboCart.map(item => item.cartId === cartId ? { ...item, staff_id: staffId } : item));
  };

  const handleComboCheckoutClick = async () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ để thực hiện thanh toán');
    if (!hasPermission('sale.create')) return alert('Bạn không có quyền thanh toán');
    if (comboCart.length < 2) return alert('Combo phải chứa ít nhất 2 dịch vụ');
    if (!comboBedId) return alert('Vui lòng chọn Chỗ (Bắt buộc)');
    if (comboCart.some(item => !item.staff_id)) return alert('Vui lòng chọn Kỹ thuật viên cho tất cả dịch vụ');

    setLoading(true);
    const customer = comboCustomerId ? customersList.find(c => c.id === comboCustomerId) : null;
    const finalCustName = customer?.name || comboCustomerName || 'Khách lẻ Combo';
    const finalCustPhone = customer?.phone || '';

    try {
      // 1. Tạo combo_group
      const comboCode = 'CB' + new Date().getDate().toString().padStart(2, '0') + (new Date().getMonth() + 1).toString().padStart(2, '0') + Math.floor(1000 + Math.random() * 9000).toString();
      const { data: comboGrp, error: comboErr } = await supabase.from('combo_groups').insert([{
        shop_id: shopId,
        combo_code: comboCode,
        customer_name: finalCustName,
        customer_phone: finalCustPhone,
        bed_id: comboBedId,
        status: 'in_progress'
      }]).select().single();

      if (comboErr || !comboGrp) throw new Error('Lỗi tạo nhóm Combo: ' + comboErr?.message);

      // 2. Tạo N service_sessions
      const sessionsToInsert = comboCart.map((item, index) => ({
        shop_id: shopId,
        service_id: item.id,
        staff_id: item.staff_id,
        bed_id: comboBedId,
        service_price: item.price,
        discount_type: item.discountType || 'amount',
        discount_value: item.discountValue || 0,
        status: 'in_progress',
        is_retail: true,
        retail_customer_name: finalCustName,
        retail_customer_phone: finalCustPhone,
        combo_group_id: comboGrp.id,
        session_code: 'S' + new Date().getDate().toString().padStart(2, '0') + (new Date().getMonth() + 1).toString().padStart(2, '0') + Math.floor(100 + index).toString() + Math.floor(100 + Math.random() * 900).toString()
      }));

      const { error: sessErr } = await supabase.from('service_sessions').insert(sessionsToInsert);
      
      if (sessErr) {
        if (sessErr.code === '23505' || sessErr.message?.includes('bed_in_use')) {
          throw new Error('Chỗ này vừa được người khác xếp! Vui lòng chọn chỗ khác.');
        } else {
          throw new Error('Lỗi tạo cuốc dịch vụ: ' + sessErr.message);
        }
      }

      setComboCart([]);
      setComboBedId('');
      setComboCustomerName('');
      setComboCustomerId('');
      
      // Load lại list chỗ bằng cách tính toán động
      const [newBedsRes, newSessionsRes] = await Promise.all([
        supabase.from('beds').select('*').eq('shop_id', shopId).order('name'),
        supabase.from('service_sessions').select('bed_id').eq('shop_id', shopId).eq('status', 'in_progress')
      ]);
      const activeIds = (newSessionsRes.data || []).map(s => s.bed_id);
      setBedsList((newBedsRes.data || []).filter(b => !activeIds.includes(b.id)));

      alert('Đã xếp khách COMBO vào chỗ thành công! Chuyển sang tab Chỗ để theo dõi và thanh toán.');
    } catch (e: any) {
      alert(e.message);
    }
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
    logPrintEvent('handleConfirmCheckout');
    if (!previewInvoiceData) return;
    setLoading(true);

    try {
      if (previewInvoiceData.type === 'retail') {
        // Tính năng này đã chuyển sang Beds.tsx (Thanh toán sau khi làm xong)
        // Đoạn code này được giữ lại để phòng hờ, nhưng hiện tại POS không gọi setPreviewInvoiceData('retail') nữa.
      } else if (previewInvoiceData.type === 'sell_package') {
        const { subtotal, discount, finalTotal, customerName, customerPhone, selectedPkgId, sellerId, total_sessions, original_price, pkg_sale_price, commission_sale_type, commission_sale_value, pkg_name } = previewInvoiceData;

        const invCode = `HD${new Date().getDate().toString().padStart(2, '0')}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000).toString()}`;

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

        const finalCardCode = 'T' + Math.floor(Math.random() * 100).toString().padStart(2, '0') + invCode;

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

        // Cập nhật ngược ID sale vào customer_packages để dễ dàng truy vấn
        await supabase
          .from('customer_packages')
          .update({ package_sale_id: sale.id })
          .eq('id', custPkg.id);

        const { error: commLogErr } = await supabase.from('commission_logs').insert([{ shop_id: shopId, staff_id: validSellerId, amount: salesComm, type: 'package_sale', package_sale_id: sale.id, note: `Bán gói: ${pkg_name}` }]);
        if (commLogErr) throw new Error(`Lỗi lưu hoa hồng bán gói: ${commLogErr.message}`);
        const { error: revLogErr } = await supabase.from('revenue_logs').insert([{ shop_id: shopId, amount: finalTotal, type: 'package_sale', package_sale_id: sale.id }]);
        if (revLogErr) throw new Error(`Lỗi lưu doanh thu bán gói: ${revLogErr.message}`);

        logPrintEvent('setCompletedInvoice');
        setCompletedInvoice({
          ...inv,
          items: [{ name: pkg_name, price: original_price, discount: pkgDiscountType === 'percent' ? (original_price * pkgDiscountValue) / 100 : pkgDiscountValue }],
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

        const sessCode = 'P' + Math.floor(Math.random() * 100).toString().padStart(2, '0') + cp.card_code;

        const { data: sess, error: sessErr } = await supabase.from('service_sessions').insert([{ 
          shop_id: shopId, 
          service_id: svc.id, 
          staff_id: technicianId, 
          customer_package_id: cp.id,
          bed_id: bedId,
          status: 'in_progress',
          is_retail: false,
          session_code: sessCode
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
        logPrintEvent('setIsPrinting');
        setIsPrinting(true);
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
    logPrintEvent('handlePrint');
    captureComponentTree(profile, completedInvoice, isPrinting, true, false);
    captureDOM();
    logPrintEvent('setIsPrinting');
    setIsPrinting(true);
  };

  if (!shopId) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Loader2 className="animate-spin" style={{ marginRight: '0.5rem' }} /> Đang tải dữ liệu cửa hàng...
      </div>
    );
  }

  return (
    <div className="page-container compact-view animate-fade">
      <div className="no-print mobile-tabs" style={{ marginBottom: '1rem' }}>
        <button onClick={() => setActiveTab('retail')} className="btn mobile-tab" style={{ background: activeTab === 'retail' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'retail' ? 'white' : 'inherit' }}>
          <Zap size={18} /> Bán lẻ
        </button>
        <button onClick={() => setActiveTab('combo')} className="btn mobile-tab" style={{ background: activeTab === 'combo' ? 'var(--warning)' : 'var(--bg-main)', color: activeTab === 'combo' ? 'white' : 'inherit' }}>
          <Zap size={18} /> Combo
        </button>
        <button onClick={() => setActiveTab('sell_package')} className="btn mobile-tab" style={{ background: activeTab === 'sell_package' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'sell_package' ? 'white' : 'inherit' }}>
          <PackageIcon size={18} /> Bán liệu trình
        </button>
        <button onClick={() => setActiveTab('use_package')} className="btn mobile-tab" style={{ background: activeTab === 'use_package' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'use_package' ? 'white' : 'inherit' }}>
          <Calendar size={18} /> Dùng liệu trình
        </button>
      </div>

      <div className="no-print" style={{ height: '2px', background: '#3b82f6', marginBottom: '1.5rem', borderRadius: '2px' }}></div>

      <div className="pos-grid">
        <div className="no-print">
        {activeTab === 'retail' && (
          <div className="animate-fade">
            {!activeGroupId && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <button className={`btn ${posViewMode === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPosViewMode('all')}>Tất cả</button>
                <button className={`btn ${posViewMode === 'groups' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPosViewMode('groups')}>Nhóm</button>
              </div>
            )}

            {activeGroupId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setActiveGroupId(null)}><ArrowLeft size={18} /> Quay lại</button>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, textTransform: 'uppercase', color: 'var(--text-main)' }}>
                  {groups.find(g => g.id === activeGroupId)?.name}
                </h2>
              </div>
            )}

            <div className="premium-card mobile-stack" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
              <div style={{ position: 'relative', flex: 1, width: '100%' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={posViewMode === 'groups' && !activeGroupId ? "Tìm nhóm..." : "Tìm tên dịch vụ..."} 
                  style={{ paddingLeft: '2.75rem', width: '100%' }}
                  value={retailSearchTerm}
                  onChange={(e) => setRetailSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {posViewMode === 'groups' && !activeGroupId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {groups.filter(g => g.name.toLowerCase().includes(retailSearchTerm.toLowerCase())).map(g => (
                  <div key={g.id} className="premium-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setActiveGroupId(g.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <Folder size={24} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{g.name}</h4>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{services.filter(s => s.service_group_id === g.id).length} dịch vụ</div>
                      </div>
                    </div>
                    <ChevronRight size={20} color="var(--text-light)" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {services.length === 0 && !loading && (
                  <div className="premium-card" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                    <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Không tìm thấy dịch vụ nào</p>
                    <p style={{ fontSize: '0.875rem' }}>Vui lòng kiểm tra lại cấu hình Database (RLS / shop_id).</p>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '0.25rem' }}>
                  {services.filter(s => (!activeGroupId || s.service_group_id === activeGroupId) && s.name.toLowerCase().includes(retailSearchTerm.toLowerCase())).map(s => (
                    <div key={s.id} onClick={() => addToCart(s)} className="premium-card" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: '8px', minWidth: 0 }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '0.25rem' }}>
                        <h4 style={{ fontSize: isMobile ? (s.name.length > 20 ? '0.65rem' : '0.75rem') : (s.name.length > 20 ? '0.75rem' : '0.85rem'), marginBottom: '0.1rem', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2' }}>{s.name}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: '700', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{Number(s.price).toLocaleString()}đ</span>
                          {s.duration_minutes ? <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>• {s.duration_minutes}p</span> : null}
                        </div>
                      </div>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Plus size={14} color="var(--primary)" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'combo' && (
          <div className="animate-fade">
            {!activeGroupId && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <button className={`btn ${posViewMode === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPosViewMode('all')}>Tất cả</button>
                <button className={`btn ${posViewMode === 'groups' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPosViewMode('groups')}>Nhóm</button>
              </div>
            )}

            {activeGroupId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setActiveGroupId(null)}><ArrowLeft size={18} /> Quay lại</button>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, textTransform: 'uppercase', color: 'var(--text-main)' }}>
                  {groups.find(g => g.id === activeGroupId)?.name}
                </h2>
              </div>
            )}

            <div className="premium-card mobile-stack" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
              <div style={{ position: 'relative', flex: 1, width: '100%' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={posViewMode === 'groups' && !activeGroupId ? "Tìm nhóm..." : "Tìm tên dịch vụ cho Combo..."} 
                  style={{ paddingLeft: '2.75rem', width: '100%' }}
                  value={comboSearchTerm}
                  onChange={(e) => setComboSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {posViewMode === 'groups' && !activeGroupId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {groups.filter(g => g.name.toLowerCase().includes(comboSearchTerm.toLowerCase())).map(g => (
                  <div key={g.id} className="premium-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', border: '1px dashed var(--warning)' }} onClick={() => setActiveGroupId(g.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
                        <Folder size={24} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{g.name}</h4>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{services.filter(s => s.service_group_id === g.id).length} dịch vụ</div>
                      </div>
                    </div>
                    <ChevronRight size={20} color="var(--text-light)" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {services.length === 0 && !loading && (
                  <div className="premium-card" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                    <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Không tìm thấy dịch vụ nào</p>
                    <p style={{ fontSize: '0.875rem' }}>Vui lòng kiểm tra lại cấu hình Database.</p>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '0.25rem' }}>
                  {services.filter(s => (!activeGroupId || s.service_group_id === activeGroupId) && s.name.toLowerCase().includes(comboSearchTerm.toLowerCase())).map(s => (
                    <div key={s.id} onClick={() => addToComboCart(s)} className="premium-card" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px dashed var(--warning)', padding: '0.4rem 0.5rem', borderRadius: '8px', minWidth: 0 }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '0.25rem' }}>
                        <h4 style={{ fontSize: isMobile ? (s.name.length > 20 ? '0.65rem' : '0.75rem') : (s.name.length > 20 ? '0.75rem' : '0.85rem'), marginBottom: '0.1rem', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2' }}>{s.name}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: '700', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{Number(s.price).toLocaleString()}đ</span>
                          {s.duration_minutes ? <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>• {s.duration_minutes}p</span> : null}
                        </div>
                      </div>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Plus size={14} color="var(--warning)" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
                style={{ width: '100%', height: '50px', boxShadow: '0 0 12px rgba(109, 40, 217, 0.5)' }}
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
                    <button onClick={handleUseSessionClick} disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'var(--success)', boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)' }}>{loading ? <Loader2 className="animate-spin" /> : 'Bắt đầu & Xếp chỗ'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {(!isMobile || showMobileCart || completedInvoice) && (
        <div className={`no-print pos-right-column ${isMobile && showMobileCart && !completedInvoice ? 'mobile-cart-modal' : ''}`}>
        {completedInvoice ? (
          <div className="premium-card animate-fade" style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--success)', marginBottom: '1rem' }}><CheckCircle2 size={48} style={{ display: 'inline' }} /></div>
            <h3 style={{ marginBottom: '0.5rem' }}>Thanh toán thành công</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Hoá đơn #{completedInvoice.invoice_code || '---'}</p>
            <button onClick={handlePrint} className="btn btn-primary" style={{ width: '100%', marginBottom: '0.5rem' }}><Printer size={18} /> In hoá đơn</button>
            <button onClick={() => setCompletedInvoice(null)} className="btn" style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)' }}>Tiếp tục bán hàng</button>
          </div>
        ) : (
          <div className="premium-card pos-cart-card" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* FIXED HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '800' }}>Chi tiết đơn hàng</h3>
              {isMobile && (
                <button onClick={() => setShowMobileCart(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', lineHeight: 1, padding: 0 }}>&times;</button>
              )}
            </div>

            {/* SCROLLABLE ITEMS */}
            <div className="cart-items-container" style={{ padding: '0 1.25rem', flex: 1, overflowY: 'auto' }}>
              {(activeTab === 'retail' ? cart.length === 0 : comboCart.length === 0) ? (
                <div className="empty-order" style={{ padding: '2rem 0' }}>
                  <ShoppingCart size={48} />
                  <h3 style={{ margin: 0 }}>Chưa có dịch vụ</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>Chọn dịch vụ để bắt đầu tạo đơn hàng</p>
                </div>
              ) : (
                <>
                  {activeTab === 'retail' && cart.map((item, idx) => {
                    const dAmount = item.discountType === 'percent' ? (item.price * (item.discountValue || 0)) / 100 : (item.discountValue || 0);
                    return (
                    <div key={item.cartId} style={{ padding: '1rem 0', borderBottom: '1px dashed var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{item.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{Number(item.price).toLocaleString()}đ</div>
                          <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Giảm:</span>
                        <select 
                          className="form-control" 
                          style={{ width: '80px', padding: '0.2rem', fontSize: '0.75rem' }}
                          value={item.discountType || 'amount'}
                          onChange={(e) => setCart(cart.map((c, i) => i === idx ? { ...c, discountType: e.target.value } : c))}
                        >
                          <option value="amount">VNĐ</option>
                          <option value="percent">%</option>
                        </select>
                        <input 
                          type="number" 
                          className="form-control" 
                          style={{ width: '100px', padding: '0.2rem', fontSize: '0.75rem' }}
                          value={item.discountValue || ''}
                          onChange={(e) => setCart(cart.map((c, i) => i === idx ? { ...c, discountValue: Number(e.target.value) } : c))}
                          min="0"
                          placeholder="0"
                        />
                        {dAmount > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 'bold' }}>-{dAmount.toLocaleString()}đ</span>}
                      </div>
                    </div>
                  )})}

                  {activeTab === 'combo' && comboCart.map((item, idx) => {
                    const dAmount = item.discountType === 'percent' ? (item.price * (item.discountValue || 0)) / 100 : (item.discountValue || 0);
                    return (
                    <div key={item.cartId} style={{ padding: '1rem 0', borderBottom: '1px dashed var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{item.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{Number(item.price).toLocaleString()}đ</div>
                          <button onClick={() => setComboCart(comboCart.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Giảm:</span>
                        <select 
                          className="form-control" 
                          style={{ width: '80px', padding: '0.2rem', fontSize: '0.75rem' }}
                          value={item.discountType || 'amount'}
                          onChange={(e) => setComboCart(comboCart.map((c, i) => i === idx ? { ...c, discountType: e.target.value } : c))}
                        >
                          <option value="amount">VNĐ</option>
                          <option value="percent">%</option>
                        </select>
                        <input 
                          type="number" 
                          className="form-control" 
                          style={{ width: '100px', padding: '0.2rem', fontSize: '0.75rem' }}
                          value={item.discountValue || ''}
                          onChange={(e) => setComboCart(comboCart.map((c, i) => i === idx ? { ...c, discountValue: Number(e.target.value) } : c))}
                          min="0"
                          placeholder="0"
                        />
                        {dAmount > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 'bold' }}>-{dAmount.toLocaleString()}đ</span>}
                      </div>
                      <div>
                        <select className="form-select" style={{ height: '36px', fontSize: '0.85rem' }} value={item.staff_id} onChange={e => updateComboCartStaff(item.cartId, e.target.value)}>
                          <option value="">-- KTV cho dịch vụ này --</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                      </div>
                    </div>
                  )})}
                  
                  <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(109, 40, 217, 0.05)', borderRadius: '12px', border: '1px solid rgba(109, 40, 217, 0.15)', marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--primary)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '6px', height: '16px', background: 'var(--primary)', borderRadius: '4px' }}></span> Kỹ thuật viên & Chỗ
                      </h4>
                      {activeTab === 'retail' && (
                        <select className="form-select" style={{ marginBottom: '0.75rem', height: '48px', borderRadius: '12px', borderColor: 'var(--primary)', fontWeight: '600' }} value={retailStaffId} onChange={e => setRetailStaffId(e.target.value)}>
                          <option value="">-- Chọn Kỹ thuật viên (Bắt buộc) --</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                      )}
                      {activeTab === 'retail' ? (
                        <select className="form-select" style={{ height: '48px', borderRadius: '12px', borderColor: 'var(--primary)', fontWeight: '600' }} value={retailBedId} onChange={e => setRetailBedId(e.target.value)}>
                          <option value="">-- Chọn Chỗ (Trống) --</option>
                          {bedsList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      ) : (
                        <select className="form-select" style={{ height: '48px', borderRadius: '12px', borderColor: 'var(--primary)', fontWeight: '600' }} value={comboBedId} onChange={e => setComboBedId(e.target.value)}>
                          <option value="">-- Chọn Chỗ (Trống) --</option>
                          {bedsList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      )}
                    </div>

                    <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-main)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '6px', height: '16px', background: 'var(--text-light)', borderRadius: '4px' }}></span> Khách hàng
                      </h4>
                      <select className="form-select" style={{ marginBottom: '0.75rem', height: '48px', borderRadius: '12px' }} value={activeTab === 'retail' ? retailCustomerId : comboCustomerId} onChange={e => { 
                        if (activeTab === 'retail') { setRetailCustomerId(e.target.value); setRetailCustomerName(''); }
                        else { setComboCustomerId(e.target.value); setComboCustomerName(''); }
                      }}>
                        <option value="">Khách vãng lai (Nhập tên phía dưới)</option>
                        {customersList.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `- ${c.phone}` : ''}</option>)}
                      </select>
                      {!(activeTab === 'retail' ? retailCustomerId : comboCustomerId) && (
                        <input type="text" className="form-input" placeholder="Tên khách lẻ (Không bắt buộc)..." style={{ height: '48px', borderRadius: '12px' }} value={activeTab === 'retail' ? customerName : comboCustomerName} onChange={e => {
                          if (activeTab === 'retail') setRetailCustomerName(e.target.value);
                          else setComboCustomerName(e.target.value);
                        }} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* FIXED FOOTER FORM */}
            {(activeTab === 'retail' ? cart.length > 0 : comboCart.length > 0) && (
              <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
                  <span>Tổng tiền:</span>
                  <span style={{ color: 'var(--primary)' }}>
                    {(activeTab === 'retail' 
                      ? cart.reduce((sum, item) => {
                          const d = item.discountType === 'percent' ? (item.price * (item.discountValue || 0)) / 100 : (item.discountValue || 0);
                          return sum + (Number(item.price) - d);
                        }, 0)
                      : comboCart.reduce((sum, item) => {
                          const d = item.discountType === 'percent' ? (item.price * (item.discountValue || 0)) / 100 : (item.discountValue || 0);
                          return sum + (Number(item.price) - d);
                        }, 0)
                    ).toLocaleString()}đ
                  </span>
                </div>
                <button onClick={activeTab === 'retail' ? handleRetailCheckoutClick : handleComboCheckoutClick} disabled={loading} className="btn btn-primary" style={{ width: '100%', height: '50px', fontSize: '16px', fontWeight: 'bold', borderRadius: '12px', background: activeTab === 'combo' ? 'var(--warning)' : 'var(--primary)', boxShadow: activeTab === 'combo' ? '0 0 12px rgba(245, 158, 11, 0.5)' : '0 0 12px rgba(109, 40, 217, 0.5)' }}>
                  {loading ? <Loader2 className="animate-spin" /> : 'XẾP CHỖ NGAY'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* THANH STICKY DÀNH RIÊNG CHO MOBILE NẰM DƯỚI CÙNG */}
      {activeTab === 'retail' && cart.length > 0 && isMobile && !showMobileCart && (
        <div className="checkout-bar mobile-only" onClick={() => setShowMobileCart(true)} style={{ cursor: 'pointer' }}>
          <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>
            Tổng: <span style={{ color: 'var(--primary)' }}>{cart.reduce((a, b) => a + Number(b.price), 0).toLocaleString()}đ</span>
          </div>
          <button className="btn btn-primary" style={{ height: '48px', padding: '0 1.5rem' }}>
            Tiếp tục
          </button>
        </div>
      )}
      {isPrinting && completedInvoice && (
        <DebugPrintContainer onPrinted={() => { logPrintEvent('PrintContainer onPrinted (setIsPrinting false)'); setIsPrinting(false); }}>
          <DebugReceiptTemplate
            profile={profile}
            invoice={completedInvoice}
            config={{
              shop_name: 'SPA & POS', // Tương lai lấy từ db: profile.shop_settings.shop_name
              paper_size: '80mm', // Tương lai lấy từ db: profile.shop_settings.paper_size
              footer_message: 'Cảm ơn quý khách! Hẹn gặp lại.'
            }}
            printSettings={printSettings}
            renderInline={true} // Cực kỳ quan trọng để ăn class .inline-receipt
          />
        </DebugPrintContainer>
      )}

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

      {/* Sticky Checkout Bar Mobile */}
      {activeTab === 'retail' && cart.length > 0 && (
        <div className="checkout-bar mobile-only">
          <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>
            Tổng: <span style={{ color: 'var(--primary)' }}>{cart.reduce((a, b) => a + Number(b.price), 0).toLocaleString()}đ</span>
          </div>
          <button onClick={handleRetailCheckoutClick} disabled={loading} className="btn btn-primary" style={{ height: '48px', padding: '0 1.5rem' }}>
            {loading ? <Loader2 className="animate-spin" /> : 'Xếp chỗ ngay'}
          </button>
        </div>
      )}
    </div>
    </div>
  );
};

export default POS;
