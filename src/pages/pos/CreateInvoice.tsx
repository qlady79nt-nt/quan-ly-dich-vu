import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, PlayCircle, X, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface CartItem {
  service: any;
  staffId: string;
  bedId: string;
}

const POSCreateInvoice = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [services, setServices] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [searchSvc, setSearchSvc] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => { if (shopId) fetchData(); }, [shopId]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: svcData }, { data: bedData }, { data: staffData }] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId).eq('status', 'active').order('name'),
      supabase.from('beds').select('*').eq('shop_id', shopId).eq('status', 'available').order('name'),
      supabase.from('profiles').select('id, full_name').eq('shop_id', shopId).eq('status', 'active').in('role', ['staff', 'manager']),
    ]);
    setServices(svcData || []);
    setBeds(bedData || []);
    setStaffList(staffData || []);
    setLoading(false);
  };

  const addToCart = (svc: any) => {
    setCart(prev => [...prev, { service: svc, staffId: '', bedId: '' }]);
  };

  const removeFromCart = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const updateCart = (idx: number, field: 'staffId' | 'bedId', value: string) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const subtotal = cart.reduce((sum, item) => sum + Number(item.service.price), 0);
  const total = Math.max(0, subtotal - discount);

  const handleStart = async () => {
    if (cart.length === 0) return alert('Chưa chọn dịch vụ nào!');
    const invalid = cart.find(item => !item.staffId || !item.bedId);
    if (invalid) return alert('Vui lòng chọn Nhân viên và Chỗ cho mỗi dịch vụ!');

    setStarting(true);
    try {
      // 1. Tạo Invoice
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          shop_id: shopId,
          branch_id: null,
          customer_name: customerName || 'Khách lẻ',
          customer_phone: customerPhone || null,
          subtotal,
          discount,
          total,
          status: 'pending',
          created_by: profile?.id,
        })
        .select().single();
      if (invErr) throw invErr;

      // 2. Tạo service_sessions + cập nhật bed status
      for (const item of cart) {
        const endTime = new Date(Date.now() + item.service.duration_minutes * 60000).toISOString();

        await supabase.from('service_sessions').insert({
          shop_id: shopId,
          invoice_id: invoice.id,
          service_id: item.service.id,
          bed_id: item.bedId,
          staff_id: item.staffId,
          start_time: new Date().toISOString(),
          end_time: endTime,
          status: 'in_progress',
        });

        // Update bed status
        await supabase.from('beds').update({ status: 'occupied' }).eq('id', item.bedId);
      }

      alert(`✅ Đã bắt đầu dịch vụ!\n👤 Khách: ${customerName || 'Khách lẻ'}\n💰 Tổng: ${total.toLocaleString('vi-VN')}đ`);
      navigate('/pos/monitor');
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setStarting(false);
    }
  };

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchSvc.toLowerCase())
  );

  if (!shopId) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '1rem' }}>
      <h3 style={{ color: 'var(--danger-color)' }}>Chưa liên kết cửa hàng</h3>
    </div>
  );

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--primary-color)' }}>
      <Loader2 size={32} className="animate-spin" style={{ display: 'inline' }} />
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>

      {/* LEFT PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Khách hàng */}
        <div className="premium-card">
          <h2 style={{ marginBottom: '1rem', color: 'var(--primary-color)', fontSize: '1.05rem' }}>1. Thông Tin Khách Hàng</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tên khách (tuỳ chọn)</label>
              <input type="text" className="form-input" placeholder="Chị Lan, Anh Tuấn..." value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số điện thoại (tuỳ chọn)</label>
              <input type="tel" className="form-input" placeholder="0909 123 456" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Chọn dịch vụ */}
        <div className="premium-card">
          <h2 style={{ marginBottom: '1rem', color: 'var(--primary-color)', fontSize: '1.05rem' }}>2. Chọn Dịch Vụ</h2>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input type="text" className="form-input" placeholder="Tìm dịch vụ..." style={{ paddingLeft: '2.25rem' }} value={searchSvc} onChange={e => setSearchSvc(e.target.value)} />
          </div>

          {filteredServices.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>
              {services.length === 0 ? 'Chưa có dịch vụ — tạo tại Admin Panel' : 'Không tìm thấy'}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {filteredServices.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => addToCart(svc)}
                  style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', background: 'white' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)'; (e.currentTarget as HTMLElement).style.background = 'rgba(109,40,217,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLElement).style.background = 'white'; }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>{svc.name}</div>
                  <div style={{ color: 'var(--primary-color)', fontWeight: 700, marginBottom: '0.25rem' }}>{Number(svc.price).toLocaleString('vi-VN')}đ</div>
                  <div style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>⏱ {svc.duration_minutes} phút</div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--primary-light)' }}>
                    <Plus size={14} /> Thêm vào hoá đơn
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phân bổ */}
        {cart.length > 0 && (
          <div className="premium-card">
            <h2 style={{ marginBottom: '1rem', color: 'var(--primary-color)', fontSize: '1.05rem' }}>3. Phân Bổ Nhân Viên & Chỗ</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cart.map((item, idx) => (
                <div key={idx} style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <div>
                      <strong>{item.service.name}</strong>
                      <span style={{ marginLeft: '0.5rem', color: 'var(--primary-color)', fontWeight: 700 }}>{Number(item.service.price).toLocaleString('vi-VN')}đ</span>
                      <span style={{ marginLeft: '0.5rem', color: 'var(--text-light)', fontSize: '0.8rem' }}>({item.service.duration_minutes} phút)</span>
                    </div>
                    <button onClick={() => removeFromCart(idx)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '0.4rem', padding: '0.3rem', cursor: 'pointer', color: 'var(--danger-color)', display: 'flex' }}>
                      <X size={18} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Nhân viên thực hiện *</label>
                      <select className="form-select" value={item.staffId} onChange={e => updateCart(idx, 'staffId', e.target.value)} required>
                        <option value="">-- Chọn nhân viên --</option>
                        {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Chỗ thực hiện *</label>
                      <select className="form-select" value={item.bedId} onChange={e => updateCart(idx, 'bedId', e.target.value)} required>
                        <option value="">-- Chọn chỗ trống --</option>
                        {beds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL - HOÁ ĐƠN */}
      <div className="premium-card" style={{ position: 'sticky', top: '1.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
          <ShoppingCart size={22} /> Hoá Đơn
        </h2>

        {customerName && (
          <div style={{ background: 'rgba(109,40,217,0.08)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
            👤 <strong>{customerName}</strong> {customerPhone && `| 📞 ${customerPhone}`}
          </div>
        )}

        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
            <ShoppingCart size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <p>Chưa có dịch vụ nào</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {cart.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed var(--border-color)', fontSize: '0.9rem' }}>
                <span>{item.service.name}</span>
                <span style={{ fontWeight: 600 }}>{Number(item.service.price).toLocaleString('vi-VN')}đ</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Tạm tính:</span>
          <span>{subtotal.toLocaleString('vi-VN')}đ</span>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label className="form-label">Giảm giá (VNĐ)</label>
          <input type="number" className="form-input" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value))} style={{ padding: '0.5rem' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(109,40,217,0.05)', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid rgba(109,40,217,0.2)' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tổng cộng:</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--danger-color)' }}>{total.toLocaleString('vi-VN')}đ</span>
        </div>

        <button
          onClick={handleStart}
          disabled={starting || cart.length === 0}
          className="btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          {starting ? <Loader2 size={22} className="animate-spin" /> : <PlayCircle size={22} />}
          {starting ? 'Đang xử lý...' : 'BẮT ĐẦU DỊCH VỤ NGAY'}
        </button>

        {beds.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--warning-color)', marginTop: '0.5rem', textAlign: 'center' }}>
            ⚠ Không có chỗ trống
          </p>
        )}
      </div>
    </div>
  );
};

export default POSCreateInvoice;
