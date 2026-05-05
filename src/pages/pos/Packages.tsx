import { useState, useEffect } from 'react';
import { Package, UserCheck, PlayCircle, Search, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const POSPackages = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;
  const [activeTab, setActiveTab] = useState<'sell' | 'use'>('sell');

  // SELL TAB state
  const [packages, setPackages] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [sellForm, setSellForm] = useState({ customerName: '', customerPhone: '', packageId: '', staffId: '' });
  const [selling, setSelling] = useState(false);

  // USE TAB state
  const [searchPhone, setSearchPhone] = useState('');
  const [foundPackages, setFoundPackages] = useState<any[]>([]);
  const [selectedCustPkg, setSelectedCustPkg] = useState<any>(null);
  const [beds, setBeds] = useState<any[]>([]);
  const [useForm, setUseForm] = useState({ staffId: '', bedId: '' });
  const [using, setUsing] = useState(false);
  const [searching, setSearching] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => { if (shopId) fetchData(); }, [shopId]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: pkgData }, { data: staffData }, { data: bedData }] = await Promise.all([
      supabase.from('packages').select('*').eq('shop_id', shopId).eq('status', 'active').order('name'),
      supabase.from('profiles').select('id, full_name').eq('shop_id', shopId).eq('status', 'active').in('role', ['staff', 'manager']),
      supabase.from('beds').select('*').eq('shop_id', shopId).eq('status', 'available').order('name'),
    ]);
    setPackages(pkgData || []);
    setStaffList(staffData || []);
    setBeds(bedData || []);
    setLoading(false);
  };

  const handleSellPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellForm.packageId) return alert('Vui lòng chọn liệu trình');
    if (!sellForm.customerPhone) return alert('Vui lòng nhập số điện thoại khách để lưu hồ sơ');
    setSelling(true);
    try {
      const pkg = packages.find(p => p.id === sellForm.packageId);
      if (!pkg) throw new Error('Không tìm thấy liệu trình');

      // 1. Tạo Invoice
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          shop_id: shopId,
          customer_name: sellForm.customerName || 'Khách lẻ',
          customer_phone: sellForm.customerPhone,
          subtotal: pkg.price,
          discount: 0,
          total: pkg.price,
          status: 'paid',
          created_by: profile?.id,
        })
        .select().single();
      if (invErr) throw invErr;

      // 2. Tạo customer_package
      const { error: cpErr } = await supabase.from('customer_packages').insert({
        shop_id: shopId,
        invoice_id: invoice.id,
        package_id: sellForm.packageId,
        customer_name: sellForm.customerName || 'Khách lẻ',
        customer_phone: sellForm.customerPhone,
        total_sessions: pkg.total_sessions,
        used_sessions: 0,
      });
      if (cpErr) throw cpErr;

      // 3. Ghi commission nếu có nhân viên bán
      if (sellForm.staffId && pkg.commission_sale_rate > 0) {
        await supabase.from('commission_logs').insert({
          shop_id: shopId,
          staff_id: sellForm.staffId,
          amount: pkg.price * (pkg.commission_sale_rate / 100),
          type: 'package_sale',
        });
      }

      alert(`✅ Đã bán liệu trình "${pkg.name}" cho khách!\n📞 SĐT: ${sellForm.customerPhone}\n💰 Giá: ${pkg.price.toLocaleString('vi-VN')}đ\n📅 Số buổi: ${pkg.total_sessions}`);
      setSellForm({ customerName: '', customerPhone: '', packageId: '', staffId: '' });
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setSelling(false); }
  };

  const handleSearchCustomer = async () => {
    if (!searchPhone.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('customer_packages')
        .select(`
          id, total_sessions, used_sessions, customer_name, customer_phone,
          packages(name, id)
        `)
        .eq('shop_id', shopId)
        .eq('customer_phone', searchPhone.trim());

      const active = (data || []).filter(cp => cp.used_sessions < cp.total_sessions);
      setFoundPackages(active);
      if (active.length === 0) alert('Không tìm thấy liệu trình còn buổi cho số điện thoại này.');
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setSearching(false); }
  };

  const handleUseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustPkg) return alert('Chưa chọn liệu trình');
    if (!useForm.staffId || !useForm.bedId) return alert('Vui lòng chọn Nhân viên và Chỗ');
    setUsing(true);
    try {
      const pkg = packages.find(p => p.id === selectedCustPkg.packages?.id);
      const durationMinutes = pkg?.duration_minutes || 60;
      const endTime = new Date(Date.now() + durationMinutes * 60000).toISOString();

      // 1. Tạo service_session linked to customer_package
      const { error: sessErr } = await supabase.from('service_sessions').insert({
        shop_id: shopId,
        customer_package_id: selectedCustPkg.id,
        bed_id: useForm.bedId,
        staff_id: useForm.staffId,
        start_time: new Date().toISOString(),
        end_time: endTime,
        status: 'in_progress',
      });
      if (sessErr) throw sessErr;

      // 2. Tăng used_sessions
      const { error: cpErr } = await supabase
        .from('customer_packages')
        .update({ used_sessions: selectedCustPkg.used_sessions + 1 })
        .eq('id', selectedCustPkg.id);
      if (cpErr) throw cpErr;

      // 3. Cập nhật bed
      await supabase.from('beds').update({ status: 'occupied' }).eq('id', useForm.bedId);

      // 4. Ghi commission cho KTV
      if (pkg && pkg.commission_rate > 0) {
        const sessionRevenue = pkg.price / pkg.total_sessions;
        await supabase.from('commission_logs').insert({
          shop_id: shopId,
          staff_id: useForm.staffId,
          amount: sessionRevenue * (pkg.commission_rate / 100),
          type: 'service_execution',
        });
      }

      const remaining = selectedCustPkg.total_sessions - selectedCustPkg.used_sessions - 1;
      alert(`✅ Đã bắt đầu buổi liệu trình!\n📅 Còn lại: ${remaining} buổi`);
      setFoundPackages([]);
      setSelectedCustPkg(null);
      setSearchPhone('');
      setUseForm({ staffId: '', bedId: '' });
      fetchData();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setUsing(false); }
  };

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
    <div className="premium-card">
      {/* TABS */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        {([['sell', '💰 Bán Liệu Trình Mới'], ['use', '📅 Khách Dùng Liệu Trình']] as [string, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            style={{
              fontWeight: 600, fontSize: '1rem',
              color: activeTab === tab ? 'var(--primary-color)' : 'var(--text-light)',
              borderBottom: activeTab === tab ? '2px solid var(--primary-color)' : '2px solid transparent',
              background: 'none', padding: '0.75rem 1.5rem', transition: 'all 0.2s', cursor: 'pointer',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* TAB BÁN LIỆU TRÌNH */}
      {activeTab === 'sell' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <form onSubmit={handleSellPackage}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>Thông tin giao dịch</h3>
            <div className="form-group">
              <label className="form-label">Số điện thoại khách * (để lưu hồ sơ)</label>
              <input type="tel" className="form-input" placeholder="0909 123 456" value={sellForm.customerPhone} onChange={e => setSellForm({ ...sellForm, customerPhone: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tên khách (tuỳ chọn)</label>
              <input type="text" className="form-input" placeholder="Chị Lan..." value={sellForm.customerName} onChange={e => setSellForm({ ...sellForm, customerName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Chọn Liệu Trình *</label>
              <select className="form-select" value={sellForm.packageId} onChange={e => setSellForm({ ...sellForm, packageId: e.target.value })} required>
                <option value="">-- Chọn liệu trình --</option>
                {packages.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.total_sessions} buổi — {Number(p.price).toLocaleString('vi-VN')}đ
                  </option>
                ))}
              </select>
              {packages.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--warning-color)', marginTop: '0.25rem' }}>⚠ Chưa có liệu trình — tạo tại Admin Panel</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Nhân viên bán (tính hoa hồng)</label>
              <select className="form-select" value={sellForm.staffId} onChange={e => setSellForm({ ...sellForm, staffId: e.target.value })}>
                <option value="">-- Chọn (tuỳ chọn) --</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={selling || packages.length === 0}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              {selling ? <Loader2 size={20} className="animate-spin" /> : <Package size={20} />}
              {selling ? 'Đang xử lý...' : 'Tạo Hoá Đơn Bán Liệu Trình'}
            </button>
          </form>

          <div style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.05), rgba(109,40,217,0.02))', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid rgba(109,40,217,0.15)' }}>
            <h4 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>📋 Thông tin thanh toán</h4>
            {sellForm.packageId ? (() => {
              const pkg = packages.find(p => p.id === sellForm.packageId);
              return pkg ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'white', borderRadius: '0.5rem' }}>
                    <span>Gói:</span><strong>{pkg.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'white', borderRadius: '0.5rem' }}>
                    <span>Số buổi:</span><strong>{pkg.total_sessions} buổi</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'white', borderRadius: '0.5rem' }}>
                    <span>Đơn giá/buổi:</span><strong>{(pkg.price / pkg.total_sessions).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--primary-color)', borderRadius: '0.5rem', color: 'white' }}>
                    <span>Tổng tiền:</span><strong style={{ fontSize: '1.2rem' }}>{Number(pkg.price).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', padding: '0.5rem', background: 'rgba(245,158,11,0.08)', borderRadius: '0.5rem', border: '1px solid rgba(245,158,11,0.3)' }}>
                    ℹ Doanh thu chỉ được tính khi khách sử dụng từng buổi, không tính ngay khi bán.
                  </div>
                </div>
              ) : null;
            })() : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Chọn liệu trình để xem chi tiết</div>
            )}
          </div>
        </div>
      )}

      {/* TAB DÙNG LIỆU TRÌNH */}
      {activeTab === 'use' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Tìm khách */}
          <div>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)' }}>Tìm Khách & Liệu Trình</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input type="tel" className="form-input" placeholder="Nhập SĐT khách hàng..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchCustomer()} />
              <button onClick={handleSearchCustomer} disabled={searching} className="btn-primary" style={{ padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                Tìm
              </button>
            </div>

            {foundPackages.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {foundPackages.map(cp => {
                  const remaining = cp.total_sessions - cp.used_sessions;
                  const isSelected = selectedCustPkg?.id === cp.id;
                  const isLow = remaining <= 2;
                  return (
                    <div
                      key={cp.id}
                      onClick={() => setSelectedCustPkg(cp)}
                      style={{
                        padding: '1rem', borderRadius: '0.75rem', cursor: 'pointer',
                        border: `2px solid ${isSelected ? 'var(--primary-color)' : isLow ? 'var(--warning-color)' : 'var(--border-color)'}`,
                        background: isSelected ? 'rgba(109,40,217,0.05)' : 'white',
                        transition: 'all 0.2s',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <UserCheck size={20} color={isSelected ? 'var(--primary-color)' : 'var(--secondary-color)'} />
                        <strong>{cp.customer_name}</strong> <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>({cp.customer_phone})</span>
                      </div>
                      <div style={{ fontSize: '0.9rem' }}>📦 {cp.packages?.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', alignItems: 'center' }}>
                        <div style={{ height: '6px', flex: 1, background: 'var(--border-color)', borderRadius: '3px', marginRight: '0.75rem', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(cp.used_sessions / cp.total_sessions) * 100}%`, background: isLow ? 'var(--warning-color)' : 'var(--success-color)' }} />
                        </div>
                        <span style={{ fontWeight: 700, color: isLow ? 'var(--warning-color)' : 'var(--primary-color)', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                          {isLow && <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />}
                          Còn {remaining}/{cp.total_sessions} buổi
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phân bổ session */}
          <form onSubmit={handleUseSession}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)' }}>Bắt Đầu Buổi Làm</h3>
            {!selectedCustPkg ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                <UserCheck size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>Tìm và chọn khách hàng bên trái</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '1rem', border: '2px solid var(--secondary-color)', borderRadius: '0.75rem', marginBottom: '1.5rem', background: 'rgba(212,175,55,0.05)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>👤 {selectedCustPkg.customer_name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>📦 {selectedCustPkg.packages?.name}</div>
                  <div style={{ fontWeight: 700, color: 'var(--danger-color)', fontSize: '1.1rem' }}>
                    Còn {selectedCustPkg.total_sessions - selectedCustPkg.used_sessions} buổi
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Nhân viên thực hiện *</label>
                  <select className="form-select" value={useForm.staffId} onChange={e => setUseForm({ ...useForm, staffId: e.target.value })} required>
                    <option value="">-- Chọn nhân viên --</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Chỗ thực hiện *</label>
                  <select className="form-select" value={useForm.bedId} onChange={e => setUseForm({ ...useForm, bedId: e.target.value })} required>
                    <option value="">-- Chọn chỗ trống --</option>
                    {beds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={using} className="btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--secondary-color)' }}>
                  {using ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />}
                  {using ? 'Đang xử lý...' : 'Bắt Đầu Trừ Buổi'}
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default POSPackages;
