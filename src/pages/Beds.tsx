import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Loader2, BedDouble, CheckCircle2, Clock, X, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import '../receipt.css';

const Beds = () => {
  const { profile, hasPermission, isRestricted } = useAuth();
  const shopId = profile?.shop_id;
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Checkout State
  const [checkoutSession, setCheckoutSession] = useState<any>(null);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<any>(null);

  useEffect(() => {
    if (shopId) {
      fetchBedsAndSessions();
    } else if (profile?.role === 'super_admin') {
      setLoading(false);
    }
    // Cập nhật biến now mỗi giây để đồng hồ nhảy phút chính xác và mượt mà hơn
    const timer = setInterval(() => setNow(new Date()), 1000);

    const handleAfterPrint = () => {
      setCompletedInvoice(null);
      fetchBedsAndSessions();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      clearInterval(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [shopId, profile]);

  const fetchBedsAndSessions = async () => {
    setLoading(true);
    const [bRes, sRes, svcRes, stfRes, cgRes] = await Promise.all([
      supabase.from('beds').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('service_sessions').select('*').eq('shop_id', shopId).eq('status', 'in_progress'),
      supabase.from('services').select('*').eq('shop_id', shopId),
      supabase.from('staffs').select('*').eq('shop_id', shopId),
      supabase.from('combo_groups').select('*').eq('shop_id', shopId).eq('status', 'in_progress')
    ]);
    
    if (bRes.error) console.error('Beds fetch error:', bRes.error);
    if (sRes.error) console.error('Sessions fetch error:', sRes.error);

    const bedsData = bRes.data || [];
    const sessionsData = sRes.data || [];
    const servicesData = svcRes.data || [];
    const staffsData = stfRes.data || [];
    const comboGroupsData = cgRes.data || [];

    const cpIds = sessionsData.map(s => s.customer_package_id).filter(Boolean);
    let cps: any[] = [];
    if (cpIds.length > 0) {
      const { data } = await supabase.from('customer_packages').select('id, customer_name').in('id', cpIds);
      if (data) cps = data;
    }

    const mapped = bedsData.map(b => {
      let bedSessions = sessionsData.filter(s => s.bed_id === b.id).map(sess => ({
        ...sess,
        services: servicesData.find(svc => svc.id === sess.service_id) || null,
        staffs: staffsData.find(stf => stf.id === sess.staff_id) || null,
        customer_packages: cps.find(c => c.id === sess.customer_package_id) || null
      }));
      
      const comboGroupId = bedSessions.find(s => s.combo_group_id)?.combo_group_id;
      const comboGroup = comboGroupId ? comboGroupsData.find(c => c.id === comboGroupId) : null;

      return {
        ...b,
        sessions: bedSessions,
        comboGroup,
        computed_status: bedSessions.length > 0 ? 'occupied' : 'available'
      };
    });

    // Sắp xếp tự nhiên (Natural sort) để "Giường 10" đứng sau "Giường 9"
    mapped.sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));

    setBeds(mapped);
    setLoading(false);
  };

  const handleAddBed = async () => {
    if (profile?.role !== 'shop_admin' && profile?.role !== 'super_admin') {
      return alert('Chỉ Quản lý (Shop Admin) mới có quyền thêm chỗ mới!');
    }
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    if (!shopId) return alert('Lỗi: Chưa xác định được cửa hàng.');
    const name = window.prompt('Nhập tên chỗ mới:');
    if (!name?.trim()) return;

    const { error } = await supabase.from('beds').insert([{ shop_id: shopId, name: name.trim() }]);
    if (error) alert('Lỗi khi tạo chỗ: ' + error.message);
    else fetchBedsAndSessions();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#10b981';
      case 'occupied': return '#ef4444';
      case 'cleaning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const openCheckout = (bedData: any) => {
    setCheckoutSession(bedData);
    setDiscountValue(0);
    setDiscountType('amount');
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutSession) return;
    setIsProcessing(true);

    try {
      const bedData = checkoutSession;
      
      // Nếu là thanh toán combo
      if (bedData.comboGroup) {
        const comboGroup = bedData.comboGroup;
        const sessions = bedData.sessions;
        
        const totalOriginalPrice = sessions.reduce((sum: number, sess: any) => sum + Number(sess.service_price || sess.services?.price || 0), 0);
        const discount = discountType === 'percent' ? (totalOriginalPrice * discountValue) / 100 : discountValue;
        const finalTotal = totalOriginalPrice - discount;
        
        const invCode = `HD${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000).toString()}`;
        
        const invoiceData = {
          shop_id: shopId,
          invoice_code: invCode,
          customer_name: comboGroup.customer_name,
          customer_phone: comboGroup.customer_phone,
          created_by: profile?.id,
          total_amount: totalOriginalPrice,
          discount_amount: discount,
          final_amount: finalTotal,
          status: 'paid',
          note: `Combo - ${sessions.length} dịch vụ`
        };

        const sessionsData = sessions.map((sess: any) => {
          const price = Number(sess.service_price || sess.services?.price || 0);
          const ratio = totalOriginalPrice > 0 ? price / totalOriginalPrice : 0;
          const sessionDiscount = discount * ratio;
          const sessionRevenue = price - sessionDiscount;
          const comm = sess.services?.commission_type === 'percent' ? (price * sess.services.commission_value) / 100 : sess.services.commission_value;
          
          return {
            session_id: sess.id,
            service_id: sess.service_id,
            staff_id: sess.staff_id,
            original_price: price,
            revenue_amount: sessionRevenue,
            commission_amount: comm,
            note: `Combo: ${sess.services?.name}`
          };
        });

        const { data: rpcResult, error: rpcErr } = await supabase.rpc('sp_checkout_combo', {
          p_combo_group_id: comboGroup.id,
          p_invoice_data: invoiceData,
          p_sessions_data: sessionsData
        });

        if (rpcErr) throw rpcErr;

        const { data: inv, error: invFetchErr } = await supabase.from('invoices').select('*').eq('id', rpcResult).single();
        if (invFetchErr) throw invFetchErr;

        setCompletedInvoice({
          id: inv.id,
          display_id: inv.invoice_code || '---',
          customer_name: comboGroup.customer_name || 'Khách Combo',
          customer_phone: comboGroup.customer_phone,
          staff_name: 'Combo (Nhiều KTV)',
          items: sessions.map((sess: any) => ({ name: sess.services?.name, price: Number(sess.services?.price || 0) })),
          total_amount: totalOriginalPrice,
          discount_amount: discount,
          final_amount: finalTotal,
          is_use_package: false
        });

      } else {
        // Thanh toán lẻ 1 session (cũ)
        const sess = bedData.sessions[0];
        const svc = sess.services;
        
        if (sess.customer_package_id) {
          // --- XỬ LÝ THANH TOÁN GÓI LIỆU TRÌNH QUA RPC ---
          const { data: cp, error: cpErr } = await supabase.from('customer_packages').select('*').eq('id', sess.customer_package_id).single();
          if (cpErr || !cp) throw new Error('Không tìm thấy gói liệu trình khách hàng: ' + (cpErr?.message || ''));

          // Lấy thông tin package
          const { data: pkg } = await supabase.from('packages').select('name, service_id').eq('id', cp.package_id).single();
          let svcDetails = svc;
          if (pkg?.service_id) {
             const { data: s } = await supabase.from('services').select('commission_type, commission_value').eq('id', pkg.service_id).single();
             if (s) svcDetails = { ...svc, ...s };
          }

          const unitPrice = cp.sale_price / cp.total_sessions;
          const comm = svcDetails.commission_type === 'percent' ? (svc.price * svcDetails.commission_value) / 100 : svcDetails.commission_value;

          // Call RPC for atomic package checkout
          const { data: cpData, error: rpcErr } = await supabase.rpc('sp_checkout_package_session', {
            p_session_id: sess.id,
            p_package_id: cp.package_id,
            p_revenue_amount: unitPrice,
            p_commission_amount: comm
          });
          if (rpcErr) throw rpcErr;

          setCompletedInvoice({
            id: sess.id,
            display_id: sess.session_code || '---',
            customer_name: cp.customer_name || sess.retail_customer_name || 'Khách liệu trình',
            customer_phone: cp.customer_phone || sess.retail_customer_phone,
            staff_name: sess.staffs?.full_name || 'KTV',
            items: [{ name: `Trừ 1 buổi: ${pkg?.name || svc.name}`, price: '-' }],
            total_amount: 0,
            discount_amount: 0,
            final_amount: 0,
            is_use_package: true,
            used_sessions: cpData ? cpData.used_sessions : cp.used_sessions + 1,
            total_sessions: cpData ? cpData.total_sessions : cp.total_sessions
          });
        } else {
          // --- XỬ LÝ THANH TOÁN BÁN LẺ (RPC) ---
          const price = Number(sess.service_price || svc.price);
          const discount = discountType === 'percent' ? (price * discountValue) / 100 : discountValue;
          const finalTotal = price - discount;
          const comm = svc.commission_type === 'percent' ? (price * svc.commission_value) / 100 : svc.commission_value;

          const invCode = `HD${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000).toString()}`;

          const invoiceData = {
            shop_id: shopId,
            invoice_code: invCode,
            customer_name: sess.retail_customer_name,
            customer_phone: sess.retail_customer_phone,
            created_by: profile?.id,
            total_amount: price,
            discount_amount: discount,
            final_amount: finalTotal,
            status: 'paid',
            staff_id: sess.staff_id,
            note: `Dịch vụ: ${svc.name}`,
            service_id: svc.id // pass for invoice_items creation inside RPC
          };

          const { data: rpcResult, error: rpcErr } = await supabase.rpc('sp_checkout', {
            p_session_id: sess.id,
            p_invoice_data: invoiceData,
            p_revenue_amount: finalTotal,
            p_commission_amount: comm
          });
          if (rpcErr) throw rpcErr;

          // Fetch created invoice for display
          const { data: inv, error: invFetchErr } = await supabase.from('invoices').select('*').eq('id', rpcResult).single();
          if (invFetchErr) throw invFetchErr;

          setCompletedInvoice({
            id: inv.id,
            display_id: inv.invoice_code || '---',
            customer_name: sess.retail_customer_name || 'Khách lẻ',
            customer_phone: sess.retail_customer_phone,
            staff_name: sess.staffs?.full_name || 'KTV',
            items: [{ name: svc.name, price: price }],
            total_amount: price,
            discount_amount: discount,
            final_amount: finalTotal,
            is_use_package: false
          });
        }
      }

      setCheckoutSession(null);
    } catch (err: any) {
      alert('Lỗi thanh toán: ' + err.message);
    }
    setIsProcessing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="page-container animate-fade no-print">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Quản lý Chỗ & Điều phối</h1>
          <p className="page-subtitle">Theo dõi thời gian thực các dịch vụ đang diễn ra</p>
        </div>
        {(profile?.role === 'shop_admin' || profile?.role === 'super_admin') && (
          <button className="btn btn-primary" disabled={isRestricted()} onClick={handleAddBed}>
            <Plus size={18} /> Thêm Chỗ
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {beds.map((bed) => (
            <div key={bed.id} className="premium-card" style={{ borderTop: `4px solid ${getStatusColor(bed.computed_status)}`, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: bed.sessions && bed.sessions.length > 0 ? '1rem' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ color: getStatusColor(bed.computed_status) }}>
                    <BedDouble size={24} />
                  </div>
                  <h4 style={{ fontSize: '1rem', margin: 0, fontWeight: '800' }}>{bed.name}</h4>
                  {bed.comboGroup && (
                    <span style={{ fontSize: '0.65rem', background: 'var(--warning)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>COMBO</span>
                  )}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: getStatusColor(bed.computed_status), background: `${getStatusColor(bed.computed_status)}15`, padding: '0.25rem 0.5rem', borderRadius: '1rem', whiteSpace: 'nowrap' }}>
                  {bed.computed_status === 'available' ? 'Trống' : (bed.computed_status === 'occupied' ? 'Có khách' : 'Vệ sinh')}
                </div>
              </div>
              
              {bed.sessions && bed.sessions.length > 0 && (() => {
                const isCombo = !!bed.comboGroup;
                const customerName = isCombo ? bed.comboGroup.customer_name : (bed.sessions[0].customer_packages?.customer_name || bed.sessions[0].retail_customer_name || 'Khách lẻ');
                const isPackage = !isCombo && !!bed.sessions[0].customer_package_id;
                
                // For timer, just use the first session's time
                const expectedMinutes = isCombo ? Math.max(...bed.sessions.map((s:any) => s.services?.duration_minutes || 60)) : (bed.sessions[0].services?.duration_minutes || 60);
                const elapsedMinutes = bed.sessions[0].start_time ? Math.floor((now.getTime() - new Date(bed.sessions[0].start_time).getTime()) / 60000) : 0;
                const remainingMinutes = expectedMinutes - elapsedMinutes;
                const isOvertime = remainingMinutes < 0;

                return (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-light)' }}>Khách:</span> <strong style={{ marginLeft: '0.5rem', textAlign: 'right' }}>{customerName}</strong>
                  </div>
                  
                  {isCombo ? (
                    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem', marginBottom: '0.75rem' }}>
                      {bed.sessions.map((sess: any) => (
                        <div key={sess.id} style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong style={{ color: 'var(--primary)' }}>{sess.services?.name}</strong>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>KTV: {sess.staffs?.full_name}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>DV:</span> <strong style={{ color: 'var(--primary)', marginLeft: '0.5rem', textAlign: 'right' }}>{bed.sessions[0].services?.name}</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>KTV:</span> <strong style={{ marginLeft: '0.5rem', textAlign: 'right' }}>{bed.sessions[0].staffs?.full_name}</strong>
                      </div>
                    </>
                  )}
                  
                  <div style={{ background: isOvertime ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Dự kiến: {expectedMinutes}p</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>Đã làm: {elapsedMinutes}p</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: isOvertime ? 'var(--danger)' : 'var(--warning)', fontWeight: '700', fontSize: '0.9rem' }}>
                      <Clock size={14} />
                      {isOvertime ? `Quá giờ: +${Math.abs(remainingMinutes)}p` : `Còn: ${remainingMinutes}p`}
                    </div>
                  </div>
                  
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => openCheckout(bed)} className={`btn ${isPackage ? 'btn' : 'btn-primary'}`} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', width: '100%', background: isPackage ? 'var(--success)' : (isCombo ? 'var(--warning)' : 'var(--primary)'), color: 'white', border: 'none', minHeight: '36px' }}>
                      {isPackage ? 'TRỪ BUỔI' : (isCombo ? 'THANH TOÁN COMBO' : 'TÍNH TIỀN')}
                    </button>
                  </div>
                </div>
                );
              })()}
            </div>
          ))}
          {beds.length === 0 && (
            <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
              Chưa có dữ liệu chỗ. Vui lòng thêm chỗ để quản lý.
            </div>
          )}
        </div>
      )}
      </div>

      {/* Modal Thanh Toán */}
      {checkoutSession && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 className="text-success" /> Thanh toán dịch vụ</h3>
              <button onClick={() => setCheckoutSession(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleCheckoutSubmit}>
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-light)' }}>Khách hàng:</span>
                  <strong>{checkoutSession.comboGroup?.customer_name || checkoutSession.sessions[0]?.customer_packages?.customer_name || checkoutSession.sessions[0]?.retail_customer_name || 'Khách'}</strong>
                </div>
                
                {checkoutSession.comboGroup ? (
                  <>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Danh sách dịch vụ:</div>
                    {checkoutSession.sessions.map((sess: any) => (
                      <div key={sess.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--warning)', marginBottom: '0.25rem' }}>
                        <span>{sess.services?.name} <span style={{fontSize:'0.75rem', color:'var(--text-light)'}}>({sess.staffs?.full_name})</span></span>
                        <strong>{Number(sess.service_price || sess.services?.price || 0).toLocaleString()}đ</strong>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-light)' }}>Dịch vụ:</span>
                    <strong>{checkoutSession.sessions[0]?.services?.name}</strong>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-light)' }}>Thời gian thực hiện:</span>
                  <strong style={{ color: 'var(--warning)' }}>{Math.floor((now.getTime() - new Date(checkoutSession.sessions[0]?.start_time).getTime()) / 60000)} phút</strong>
                </div>
                <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700' }}>
                  <span>{checkoutSession.sessions[0]?.customer_package_id ? 'Hình thức:' : 'Tổng giá dịch vụ:'}</span>
                  <span>{checkoutSession.sessions[0]?.customer_package_id ? 'Trừ thẻ liệu trình' : `${(checkoutSession.comboGroup ? checkoutSession.sessions.reduce((sum: number, sess: any) => sum + Number(sess.service_price || sess.services?.price || 0), 0) : Number(checkoutSession.sessions[0]?.service_price || checkoutSession.sessions[0]?.services?.price)).toLocaleString()}đ`}</span>
                </div>
              </div>

              {!checkoutSession.sessions[0]?.customer_package_id && hasPermission('sale.discount') && (
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Giảm giá (Voucher)</label>
                    <input type="number" className="form-input" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} />
                  </div>
                  <div style={{ width: '100px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Loại</label>
                    <select className="form-select" value={discountType} onChange={e => setDiscountType(e.target.value as any)}>
                      <option value="amount">VNĐ</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '0.5rem' }}>
                <span style={{ fontWeight: '700', color: 'var(--success)' }}>{checkoutSession.sessions[0]?.customer_package_id ? 'SỐ BUỔI BỊ TRỪ:' : 'KHÁCH PHẢI TRẢ:'}</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>
                  {checkoutSession.sessions[0]?.customer_package_id ? '1 Buổi' : (() => {
                    const price = checkoutSession.comboGroup ? checkoutSession.sessions.reduce((sum: number, sess: any) => sum + Number(sess.service_price || sess.services?.price || 0), 0) : Number(checkoutSession.sessions[0]?.service_price || checkoutSession.sessions[0]?.services?.price);
                    const disc = discountType === 'percent' ? (price * discountValue) / 100 : discountValue;
                    return (price - disc).toLocaleString() + 'đ';
                  })()}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setCheckoutSession(null)} className="btn" style={{ flex: 1, background: 'var(--bg-main)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing} style={{ flex: 2, background: checkoutSession.sessions[0]?.customer_package_id ? 'var(--success)' : (checkoutSession.comboGroup ? 'var(--warning)' : 'var(--primary)') }}>
                  {isProcessing ? <Loader2 className="animate-spin" /> : checkoutSession.sessions[0]?.customer_package_id ? 'XÁC NHẬN TRỪ BUỔI' : 'XÁC NHẬN THANH TOÁN'}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* Giao diện Thành công & In Hóa đơn */}
      {completedInvoice && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-main)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} className="no-print">
          <div className="premium-card animate-fade" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Thanh toán thành công!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Hoá đơn #{completedInvoice.display_id || '---'} đã được ghi nhận vào hệ thống.</p>
            
            <button onClick={handlePrint} className="btn btn-primary" style={{ width: '100%', marginBottom: '0.5rem' }}><Printer size={18} /> In hoá đơn</button>
            <button onClick={() => { setCompletedInvoice(null); fetchBedsAndSessions(); }} className="btn" style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)' }}>Quay lại Màn hình Chỗ</button>
          </div>
        </div>, document.body
      )}

      {/* GIAO DIỆN IN HOÁ ĐƠN TẬP TRUNG */}
      <ReceiptTemplate 
        invoice={completedInvoice} 
        config={{
          shop_name: 'SPA & POS', // Tương lai lấy từ db: profile.shop_settings.shop_name
          paper_size: '80mm', // Tương lai lấy từ db: profile.shop_settings.paper_size
          footer_message: 'Cảm ơn quý khách! Hẹn gặp lại.'
        }} 
      />
    </>
  );
};

export default Beds;
