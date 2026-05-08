import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Loader2, BedDouble, CheckCircle2, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

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

  useEffect(() => {
    if (shopId) {
      fetchBedsAndSessions();
    } else if (profile?.role === 'super_admin') {
      setLoading(false);
    }
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [shopId, profile]);

  const fetchBedsAndSessions = async () => {
    setLoading(true);
    const [bRes, sRes, svcRes, stfRes] = await Promise.all([
      supabase.from('beds').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('service_sessions').select('*').eq('shop_id', shopId).eq('status', 'in_progress'),
      supabase.from('services').select('*').eq('shop_id', shopId),
      supabase.from('staffs').select('*').eq('shop_id', shopId)
    ]);
    
    if (bRes.error) console.error('Beds fetch error:', bRes.error);
    if (sRes.error) console.error('Sessions fetch error:', sRes.error);

    const bedsData = bRes.data || [];
    const sessionsData = sRes.data || [];
    const servicesData = svcRes.data || [];
    const staffsData = stfRes.data || [];

    const mapped = bedsData.map(b => {
      let session = sessionsData.find(s => s.bed_id === b.id) || null;
      if (session) {
        session = {
          ...session,
          services: servicesData.find(svc => svc.id === session.service_id) || null,
          staffs: staffsData.find(stf => stf.id === session.staff_id) || null
        };
      }
      return {
        ...b,
        session,
        computed_status: session ? 'occupied' : 'available'
      };
    });

    setBeds(mapped);
    setLoading(false);
  };

  const handleAddBed = async () => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    if (!shopId) return alert('Lỗi: Chưa xác định được cửa hàng.');
    const name = window.prompt('Nhập tên giường/phòng mới:');
    if (!name?.trim()) return;

    const { error } = await supabase.from('beds').insert([{ shop_id: shopId, name: name.trim() }]);
    if (error) alert('Lỗi khi tạo giường: ' + error.message);
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

  const openCheckout = (session: any) => {
    setCheckoutSession(session);
    setDiscountValue(0);
    setDiscountType('amount');
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutSession) return;
    setIsProcessing(true);

    try {
      const sess = checkoutSession;
      const svc = sess.services;
      const price = Number(svc.price);
      
      const discount = discountType === 'percent' ? (price * discountValue) / 100 : discountValue;
      const finalTotal = price - discount;

      // 1. Tạo Invoice
      const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
        shop_id: shopId,
        customer_name: sess.retail_customer_name,
        customer_phone: sess.retail_customer_phone,
        created_by: profile?.id,
        total_amount: price,
        discount_amount: discount,
        final_amount: finalTotal,
        payment_method: 'cash',
        status: 'paid'
      }]).select().single();
      if (invErr) throw invErr;

      // 2. Tạo Invoice Item
      const { error: itemErr } = await supabase.from('invoice_items').insert([{
        invoice_id: inv.id,
        type: 'service',
        service_id: svc.id,
        staff_id: sess.staff_id,
        unit_price: price,
        final_price: price, // Giữ nguyên giá trị gốc cho commission
        price: price
      }]);
      if (itemErr) throw itemErr;

      // 3. Tính hoa hồng và update session
      const comm = svc.commission_type === 'percent' ? (price * svc.commission_value) / 100 : svc.commission_value;
      
      const { error: updErr } = await supabase.from('service_sessions').update({
        status: 'completed',
        end_time: new Date().toISOString(),
        revenue_amount: price,
        commission_amount: comm
      }).eq('id', sess.id);
      if (updErr) throw updErr;

      // 4. Ledger: Commission & Revenue
      const { error: commErr } = await supabase.from('commission_logs').insert([{ 
        shop_id: shopId, staff_id: sess.staff_id, amount: comm, type: 'service_execution', service_session_id: sess.id, note: `Dịch vụ: ${svc.name}` 
      }]);
      if (commErr) throw commErr;

      const { error: revErr } = await supabase.from('revenue_logs').insert([{ 
        shop_id: shopId, amount: finalTotal, type: 'retail', invoice_id: inv.id 
      }]);
      if (revErr) throw revErr;

      alert('Thanh toán thành công!');
      setCheckoutSession(null);
      fetchBedsAndSessions();
    } catch (err: any) {
      alert('Lỗi thanh toán: ' + err.message);
    }
    setIsProcessing(false);
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Giường & Điều phối</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Theo dõi thời gian thực các dịch vụ đang diễn ra</p>
        </div>
        <button className="btn btn-primary" disabled={isRestricted()} onClick={handleAddBed}>
          <Plus size={18} /> Thêm Giường
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-4">
          {beds.map((bed) => (
            <div key={bed.id} className="premium-card" style={{ borderTop: `4px solid ${getStatusColor(bed.computed_status)}`, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ color: getStatusColor(bed.computed_status) }}>
                  <BedDouble size={32} />
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: getStatusColor(bed.computed_status), background: `${getStatusColor(bed.computed_status)}15`, padding: '0.25rem 0.5rem', borderRadius: '1rem' }}>
                  {bed.computed_status === 'available' ? 'Trống' : (bed.computed_status === 'occupied' ? 'Đang có khách' : 'Đang vệ sinh')}
                </div>
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '800' }}>{bed.name}</h4>
              
              {bed.session ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-light)' }}>Khách:</span> <strong>{bed.session.retail_customer_name || 'Khách lẻ'}</strong>
                  </div>
                  <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-light)' }}>Dịch vụ:</span> <strong style={{ color: 'var(--primary)' }}>{bed.session.services?.name}</strong>
                  </div>
                  <div style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-light)' }}>KTV:</span> <strong>{bed.session.staffs?.full_name}</strong>
                  </div>
                  
                  <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', fontWeight: '700' }}>
                      <Clock size={16} />
                      {bed.session.start_time ? Math.floor((now.getTime() - new Date(bed.session.start_time).getTime()) / 60000) : 0} phút
                    </div>
                    <button onClick={() => openCheckout(bed.session)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                      TÍNH TIỀN
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', fontSize: '0.875rem', background: 'var(--bg-main)', borderRadius: '0.75rem', border: '1px dashed var(--border)' }}>
                  Giường đang trống
                </div>
              )}
            </div>
          ))}
          {beds.length === 0 && (
            <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
              Chưa có dữ liệu giường. Vui lòng thêm giường để quản lý.
            </div>
          )}
        </div>
      )}

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
                  <strong>{checkoutSession.retail_customer_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-light)' }}>Dịch vụ:</span>
                  <strong>{checkoutSession.services?.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-light)' }}>Thời gian thực hiện:</span>
                  <strong style={{ color: 'var(--warning)' }}>{Math.floor((now.getTime() - new Date(checkoutSession.start_time).getTime()) / 60000)} phút</strong>
                </div>
                <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700' }}>
                  <span>Giá dịch vụ:</span>
                  <span>{Number(checkoutSession.services?.price).toLocaleString()}đ</span>
                </div>
              </div>

              {hasPermission('sale.discount') && (
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
                <span style={{ fontWeight: '700', color: 'var(--success)' }}>KHÁCH PHẢI TRẢ:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>
                  {(() => {
                    const price = Number(checkoutSession.services?.price);
                    const disc = discountType === 'percent' ? (price * discountValue) / 100 : discountValue;
                    return (price - disc).toLocaleString();
                  })()}đ
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setCheckoutSession(null)} className="btn" style={{ flex: 1, background: 'var(--bg-main)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing} style={{ flex: 2 }}>
                  {isProcessing ? <Loader2 className="animate-spin" /> : 'XÁC NHẬN THANH TOÁN'}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default Beds;
