import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Package as PackageIcon, Trash2, Edit2, Loader2, Link2, Users, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Packages = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;

  const [activeTab, setActiveTab] = useState<'config' | 'customers'>('config');
  const [packages, setPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customerPackages, setCustomerPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditCustomerPackageModalOpen, setIsEditCustomerPackageModalOpen] = useState(false);
  const [editCustomerPackageData, setEditCustomerPackageData] = useState({ total_sessions: 0 });

  // Bottom sheet states
  const [selectedCustomerPackage, setSelectedCustomerPackage] = useState<any | null>(null);
  const [customerPackageHistory, setCustomerPackageHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    service_id: '',
    total_sessions: 10,
    original_price: 0,
    discount_type: 'none',
    discount_value: 0,
    sale_price: 0,
    commission_sale_type: 'percent',
    commission_sale_value: 5
  });

  useEffect(() => {
    if (profile) {
      if (activeTab === 'config') {
        fetchPackages();
        fetchServices();
      } else {
        fetchCustomerPackages();
      }
    }
  }, [profile, activeTab]);

  const fetchPackages = async () => {
    setLoading(true);
    let query = supabase.from('packages').select('*, services(name)').order('created_at', { ascending: false });

    if (profile?.role !== 'super_admin') {
      if (!shopId) {
        setLoading(false);
        return;
      }
      query = query.eq('shop_id', shopId);
    }

    const { data, error } = await query;
    if (!error) setPackages(data || []);
    setLoading(false);
  };

  const fetchServices = async () => {
    let query = supabase.from('services').select('id, name, price');
    
    if (profile?.role !== 'super_admin') {
      if (!shopId) return;
      query = query.eq('shop_id', shopId);
    }

    const { data } = await query;
    if (data) setServices(data);
  };

  const fetchCustomerPackages = async () => {
    setLoading(true);
    let query = supabase.from('customer_packages')
      .select('*')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (profile?.role !== 'super_admin') {
      if (!shopId) return;
      query = query.eq('shop_id', shopId);
    }

    const { data: cpData, error } = await query;
    if (error) {
      console.error('Error fetching customer packages:', error);
      alert('Lỗi tải danh sách khách đã mua: ' + error.message);
      setLoading(false);
      return;
    }

    if (cpData && cpData.length > 0) {
      // Lấy danh sách package_id độc nhất
      const packageIds = [...new Set(cpData.map(cp => cp.package_id).filter(Boolean))];
      
      let packagesData: any[] = [];
      if (packageIds.length > 0) {
        const { data: pkgs } = await supabase.from('packages')
          .select('id, name, service_id, services(name)')
          .in('id', packageIds);
        if (pkgs) packagesData = pkgs;
      }

      // Gộp dữ liệu thủ công (Manual Join)
      const finalData = cpData.map(cp => ({
        ...cp,
        packages: packagesData.find(p => p.id === cp.package_id) || { name: 'Gói không xác định (Hoặc đã xóa)' }
      }));
      setCustomerPackages(finalData);
    } else {
      setCustomerPackages([]);
    }
    
    setLoading(false);
  };

  const handleViewCustomerDetail = async (cp: any) => {
    setSelectedCustomerPackage(cp);
    setCustomerPackageHistory([]);
    setLoadingHistory(true);
    
    // Fetch session history for this package
    const { data } = await supabase.from('service_sessions')
      .select('id, created_at, notes, profiles(name)')
      .eq('customer_package_id', cp.id)
      .order('created_at', { ascending: false });
      
    if (data) {
      setCustomerPackageHistory(data);
    }
    setLoadingHistory(false);
  };

  const handleCloseBottomSheet = () => {
    setSelectedCustomerPackage(null);
  };

  // Logic tự động tính giá bán khi thay đổi giá gốc hoặc giảm giá
  useEffect(() => {
    let final = formData.original_price;
    if (formData.discount_type === 'percent') {
      final = final * (1 - formData.discount_value / 100);
    } else if (formData.discount_type === 'fixed') {
      final = final - formData.discount_value;
    }
    setFormData(prev => ({ ...prev, sale_price: final }));
  }, [formData.original_price, formData.discount_type, formData.discount_value]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.service_id) return alert('Vui lòng chọn dịch vụ gắn kèm');
    
    if (!shopId) {
      alert('Lỗi: Không tìm thấy ID cửa hàng. Vui lòng đăng nhập lại.');
      return;
    }

    setSaving(true);
    
    // Ánh xạ price = sale_price để thoả mãn database constraint
    const payload = { ...formData, shop_id: shopId, price: formData.sale_price };

    let error;
    if (editingId) {
      const { error: updateErr } = await supabase.from('packages').update(payload).eq('id', editingId);
      error = updateErr;
    } else {
      const { error: insertErr } = await supabase.from('packages').insert([payload]);
      error = insertErr;
    }

    if (!error) {
      fetchPackages();
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', service_id: '', total_sessions: 10, original_price: 0, discount_type: 'none', discount_value: 0, sale_price: 0, commission_sale_type: 'percent', commission_sale_value: 5 });
    } else {
      console.error('Package save error:', error);
      alert(`Lỗi khi ${editingId ? 'cập nhật' : 'tạo'} liệu trình: ` + error.message);
    }
    setSaving(false);
  };

  const handleToggleStatus = async (p: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    const isInactive = p.status === 'inactive';
    const action = isInactive ? 'Bán lại' : 'Ngưng bán';
    if (!window.confirm(`Bạn có chắc chắn muốn ${action.toLowerCase()} liệu trình này?`)) return;
    
    setLoading(true);
    const { error } = await supabase.from('packages').update({ status: isInactive ? 'active' : 'inactive' }).eq('id', p.id);
    if (!error) {
      fetchPackages();
    } else {
      alert(`Lỗi khi ${action}: ` + error.message);
      setLoading(false);
    }
  };

  const handleHardDelete = async (id: string) => {
    if (profile?.role !== 'super_admin') return;
    if (!window.confirm('XÓA VĨNH VIỄN liệu trình này khỏi database? Hành động này DÀNH CHO SUPER ADMIN để xóa data test/bug và KHÔNG THỂ HOÀN TÁC.')) return;
    setLoading(true);
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (!error) {
      fetchPackages();
    } else {
      alert('Lỗi khi xóa cứng: ' + error.message);
      setLoading(false);
    }
  };

  const handleEdit = (pkg: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    setEditingId(pkg.id);
    setFormData({
      name: pkg.name,
      service_id: pkg.service_id,
      total_sessions: pkg.total_sessions,
      original_price: pkg.original_price,
      discount_type: pkg.discount_type || 'none',
      discount_value: pkg.discount_value || 0,
      sale_price: pkg.sale_price,
      commission_sale_type: pkg.commission_sale_type || 'percent',
      commission_sale_value: pkg.commission_sale_value || 0
    });
    setIsModalOpen(true);
  };

  const handleSaveCustomerPackageEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted()) return alert('Vui lòng gia hạn gói dịch vụ!');
    if (!selectedCustomerPackage) return;
    
    if (editCustomerPackageData.total_sessions < selectedCustomerPackage.used_sessions) {
      return alert('Tổng số buổi không thể nhỏ hơn số buổi đã sử dụng!');
    }

    setSaving(true);
    const { error } = await supabase
      .from('customer_packages')
      .update({ total_sessions: editCustomerPackageData.total_sessions })
      .eq('id', selectedCustomerPackage.id);

    if (!error) {
      setIsEditCustomerPackageModalOpen(false);
      setSelectedCustomerPackage({ ...selectedCustomerPackage, total_sessions: editCustomerPackageData.total_sessions });
      fetchCustomerPackages();
    } else {
      alert('Lỗi cập nhật: ' + error.message);
    }
    setSaving(false);
  };

  return (
    <div className="page-container animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Quản lý Liệu trình (Gói)</h1>
          <p className="page-subtitle">Quản lý cấu hình gói và danh sách khách hàng đã mua</p>
        </div>
        {activeTab === 'config' && profile?.role === 'shop_admin' && (
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', service_id: '', total_sessions: 10, original_price: 0, discount_type: 'none', discount_value: 0, sale_price: 0, commission_sale_type: 'percent', commission_sale_value: 5 });
              setIsModalOpen(true);
            }} 
            className="btn btn-primary"
            disabled={isRestricted()}
            title={isRestricted() ? 'Vui lòng gia hạn gói dịch vụ để sử dụng tính năng này' : ''}
          >
            <Plus size={18} />
            Tạo liệu trình
          </button>
        )}
      </div>

      <div className="mobile-tabs" style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => setActiveTab('config')} className="btn mobile-tab" style={{ background: activeTab === 'config' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'config' ? 'white' : 'inherit' }}>
          <PackageIcon size={18} /> Cấu hình gói
        </button>
        <button onClick={() => setActiveTab('customers')} className="btn mobile-tab" style={{ background: activeTab === 'customers' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'customers' ? 'white' : 'inherit' }}>
          <Users size={18} /> Khách đã mua
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /> Đang tải...</div>
      ) : activeTab === 'config' ? (
        <>
          <div className="desktop-only kpi-grid">
            {packages.map((p) => (
              <div key={p.id} className="premium-card" style={{ opacity: p.status === 'inactive' ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: p.status === 'inactive' ? 'rgba(0,0,0,0.05)' : 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.status === 'inactive' ? 'var(--text-light)' : 'var(--secondary)' }}>
                      <PackageIcon size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '1.1rem', margin: 0, textDecoration: p.status === 'inactive' ? 'line-through' : 'none' }}>{p.name}</h4>
                        {p.status === 'inactive' && <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-light)', border: '1px solid var(--border)' }}>NGƯNG BÁN</span>}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <Link2 size={14} /> Gắn với: {p.services?.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: p.status === 'inactive' ? 'var(--text-secondary)' : 'var(--primary)' }}>{Number(p.sale_price).toLocaleString()}đ</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>{Number(p.original_price).toLocaleString()}đ</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                    <div>Số buổi: <strong>{p.total_sessions}</strong></div>
                    <div>HH Bán: <strong>{p.commission_sale_type === 'percent' ? `${p.commission_sale_value}%` : `${p.commission_sale_value}đ`}</strong></div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {profile?.role === 'shop_admin' && (
                      <button onClick={() => handleEdit(p)} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--text-secondary)' }}><Edit2 size={14} /></button>
                    )}
                    {profile?.role === 'shop_admin' && (
                      <button onClick={() => handleToggleStatus(p)} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: p.status === 'inactive' ? 'var(--success)' : 'var(--text-light)', border: '1px solid var(--border)' }}>
                        {p.status === 'inactive' ? 'Bán lại' : 'Ngưng bán'}
                      </button>
                    )}
                    {profile?.role === 'super_admin' && (
                      <button onClick={() => handleHardDelete(p.id)} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--danger)' }} title="Xóa cứng (Super Admin)"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mobile-only mobile-list-container" style={{ marginBottom: '1.5rem' }}>
            {packages.map((p) => (
              <div key={p.id} className="mobile-list-row" onClick={() => handleEdit(p)} style={{ opacity: p.status === 'inactive' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)', textDecoration: p.status === 'inactive' ? 'line-through' : 'none' }}>{p.name}</div>
                  <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{Number(p.sale_price).toLocaleString()}đ</div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {p.total_sessions} buổi • HH {p.commission_sale_type === 'percent' ? `${p.commission_sale_value}%` : `${Number(p.commission_sale_value).toLocaleString()}đ`}
                </div>
                {p.status === 'inactive' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem', fontWeight: '600' }}>[Đã ngưng bán]</div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="animate-fade">
          <div className="premium-card mobile-stack" style={{ marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', flex: 1, width: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Tìm theo tên hoặc số điện thoại..." 
                style={{ paddingLeft: '2.75rem', width: '100%' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="premium-card">
            <div className="desktop-only table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                    <th style={{ padding: '1rem' }}>Khách hàng</th>
                    <th>Gói liệu trình</th>
                    <th>Tiến độ</th>
                    <th>Trạng thái</th>
                    <th>Ngày mua</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPackages.filter(cp => {
                    const s = searchTerm.toLowerCase();
                    if (!s) return true;
                    const nameMatch = cp.customer_name ? cp.customer_name.toLowerCase().includes(s) : false;
                    const phoneMatch = cp.customer_phone ? cp.customer_phone.includes(s) : false;
                    const cardMatch = cp.card_code ? cp.card_code.toLowerCase().includes(s) : false;
                    return nameMatch || phoneMatch || cardMatch;
                  }).map(cp => (
                    <tr key={cp.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '600' }}>{cp.customer_name || 'Khách lẻ'}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>SĐT: {cp.customer_phone}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Mã thẻ: <strong>{cp.card_code || 'Không có'}</strong></div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--primary)' }}>{cp.packages?.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{Number(cp.sale_price).toLocaleString()}đ</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '8px', background: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${(cp.used_sessions / cp.total_sessions) * 100}%`, height: '100%', background: 'var(--primary)' }}></div>
                          </div>
                          <span style={{ fontWeight: '600', minWidth: '40px' }}>{cp.used_sessions}/{cp.total_sessions}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${cp.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>
                          {cp.status === 'active' ? 'Đang dùng' : 'Đã xong'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{new Date(cp.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {customerPackages.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                        Chưa có khách hàng nào mua liệu trình
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-only mobile-list-container" style={{ margin: '0 1rem 1rem 1rem' }}>
              {customerPackages.filter(cp => {
                const s = searchTerm.toLowerCase();
                if (!s) return true;
                const nameMatch = cp.customer_name ? cp.customer_name.toLowerCase().includes(s) : false;
                const phoneMatch = cp.customer_phone ? cp.customer_phone.includes(s) : false;
                const cardMatch = cp.card_code ? cp.card_code.toLowerCase().includes(s) : false;
                return nameMatch || phoneMatch || cardMatch;
              }).map(cp => (
                <div key={cp.id} className="mobile-list-row" onClick={() => handleViewCustomerDetail(cp)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                       <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-main)' }}>{cp.customer_name || 'Khách lẻ'}</span>
                       <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.85rem' }}>{cp.used_sessions}/{cp.total_sessions}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{cp.customer_phone || '---'}</div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: cp.status === 'active' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: '600' }}>
                       <span style={{ fontSize: '10px' }}>●</span> {cp.status === 'active' ? 'Đang dùng' : 'Đã xong'}
                    </span>
                  </div>
                  
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>{cp.packages?.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <span>{Number(cp.sale_price).toLocaleString()}đ</span>
                    <span>{new Date(cp.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(cp.used_sessions / cp.total_sessions) * 100}%`, height: '100%', background: 'var(--primary)' }}></div>
                  </div>
                </div>
              ))}
              {customerPackages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                  Chưa có khách hàng nào mua liệu trình
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && createPortal(
        <div className="fullscreen-sheet-mobile-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade fullscreen-sheet-mobile" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
            
            {/* STICKY HEADER */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>{editingId ? 'Sửa liệu trình' : 'Tạo liệu trình'}</h3>
              </div>
              <button type="submit" form="package-form" className="btn btn-primary desktop-only" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }} disabled={saving}>
                Lưu
              </button>
            </div>

            <form id="package-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* SCROLLABLE CONTENT */}
              <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
                <div className="grid grid-cols-2 mobile-form-grid" style={{ gap: '1.25rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Tên liệu trình</label>
                    <input type="text" className="form-input" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ height: '48px', borderRadius: '14px', fontSize: '16px' }} />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Dịch vụ gắn kèm *</label>
                    <select className="form-select" required value={formData.service_id} onChange={(e) => setFormData({...formData, service_id: e.target.value})} style={{ height: '48px', borderRadius: '14px', fontSize: '16px' }}>
                      <option value="">-- Chọn dịch vụ --</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name} ({Number(s.price).toLocaleString()}đ)</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Tổng số buổi</label>
                    <input type="number" className="form-input" required value={formData.total_sessions} onChange={(e) => setFormData({...formData, total_sessions: Number(e.target.value)})} style={{ height: '48px', borderRadius: '14px', fontSize: '16px' }} />
                  </div>

                  <div className="mobile-section-gap" style={{ borderTop: '1px solid var(--border)', gridColumn: 'span 2', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>Cấu hình giá & giảm giá</h4>
                  </div>

                  <div style={{ gridColumn: 'span 2' }} className="mobile-form-grid">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá gốc (đ)</label>
                      <input type="number" className="form-input" required value={formData.original_price} onChange={(e) => setFormData({...formData, original_price: Number(e.target.value)})} style={{ height: '48px', borderRadius: '14px', fontSize: '16px', width: '100%' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }} className="mobile-form-grid">
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Loại giảm</label>
                        <select className="form-select" value={formData.discount_type} onChange={(e) => setFormData({...formData, discount_type: e.target.value})} style={{ height: '48px', borderRadius: '14px', fontSize: '16px' }}>
                          <option value="none">Không</option>
                          <option value="percent">%</option>
                          <option value="fixed">Tiền mặt</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá trị</label>
                        <input type="number" className="form-input" disabled={formData.discount_type === 'none'} value={formData.discount_value} onChange={(e) => setFormData({...formData, discount_value: Number(e.target.value)})} style={{ height: '48px', borderRadius: '14px', fontSize: '16px' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2', background: '#faf5ff', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Giá bán cuối: </span>
                    <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{formData.sale_price.toLocaleString()}đ</span>
                  </div>

                  <div className="mobile-section-gap" style={{ borderTop: '1px solid var(--border)', gridColumn: 'span 2', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>Hoa hồng khi bán gói</h4>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Loại hoa hồng</label>
                    <select className="form-select" value={formData.commission_sale_type} onChange={(e) => setFormData({...formData, commission_sale_type: e.target.value})} style={{ height: '48px', borderRadius: '14px', fontSize: '16px' }}>
                      <option value="percent">% (Trên giá bán)</option>
                      <option value="fixed">Tiền mặt</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá trị HH</label>
                    <input type="number" className="form-input" value={formData.commission_sale_value} onChange={(e) => setFormData({...formData, commission_sale_value: Number(e.target.value)})} style={{ height: '48px', borderRadius: '14px', fontSize: '16px' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>
                      {formData.commission_sale_type === 'percent' ? 'Ví dụ: 10 = 10% giá bán gói' : 'Ví dụ: 50000 = 50.000đ'}
                    </div>
                  </div>
                </div>
              </div>

              {/* STICKY FOOTER */}
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', background: 'white', display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn" style={{ flex: 1, background: '#f3f4f6', color: 'var(--text-main)', border: 'none', height: '56px', fontSize: '1rem', fontWeight: '600', borderRadius: '14px' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, height: '56px', fontSize: '1rem', fontWeight: '600', borderRadius: '14px' }}>
                  {saving ? <Loader2 className="animate-spin" /> : editingId ? 'Cập nhật' : 'Lưu liệu trình'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* BOTTOM SHEET: KHÁCH ĐÃ MUA DETAIL */}
      {selectedCustomerPackage && createPortal(
        <div className="bottom-sheet-overlay" onClick={handleCloseBottomSheet}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '12px auto 0' }}></div>
            
            <div className="bottom-sheet-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 0.25rem 0' }}>{selectedCustomerPackage.customer_name || 'Khách lẻ'}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{selectedCustomerPackage.customer_phone || 'Chưa có SĐT'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: selectedCustomerPackage.status === 'active' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: '600' }}>
                   <span style={{ fontSize: '12px' }}>●</span> {selectedCustomerPackage.status === 'active' ? 'Đang dùng' : 'Đã xong'}
                </div>
              </div>
            </div>

            <div className="bottom-sheet-content">
              {/* LIỆU TRÌNH */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Thông tin liệu trình</h4>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '1.05rem' }}>{selectedCustomerPackage.packages?.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Đã dùng</div>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>{selectedCustomerPackage.used_sessions}/{selectedCustomerPackage.total_sessions}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Còn lại</div>
                      <div style={{ fontWeight: '700', color: 'var(--success)', fontSize: '1rem' }}>{selectedCustomerPackage.total_sessions - selectedCustomerPackage.used_sessions} buổi</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Ngày mua</div>
                      <div style={{ fontWeight: '600' }}>{new Date(selectedCustomerPackage.created_at).toLocaleDateString('vi-VN')}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Giá mua</div>
                      <div style={{ fontWeight: '600' }}>{Number(selectedCustomerPackage.sale_price).toLocaleString()}đ</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LỊCH SỬ TRỪ BUỔI */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Lịch sử trừ buổi</h4>
                {loadingHistory ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>Đang tải lịch sử...</div>
                ) : customerPackageHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {customerPackageHistory.map((history, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px' }}></div>
                        <div style={{ flex: 1, paddingBottom: '0.75rem', borderBottom: idx === customerPackageHistory.length - 1 ? 'none' : '1px dashed var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)' }}>{new Date(history.created_at).toLocaleDateString('vi-VN')} • Trừ 1 buổi</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span>NV: {history.profiles?.name || '---'}</span>
                            <span>{new Date(history.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {history.notes && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.25rem', fontStyle: 'italic' }}>"{history.notes}"</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', color: 'var(--text-light)', fontSize: '0.85rem', textAlign: 'center', border: '1px dashed var(--border)' }}>
                    Chưa có lịch sử trừ buổi nào
                  </div>
                )}
              </div>

              {/* GHI CHÚ */}
              {selectedCustomerPackage.note && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Ghi chú nội bộ</h4>
                  <div style={{ background: 'rgba(212, 175, 55, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.2)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {selectedCustomerPackage.note}
                  </div>
                </div>
              )}
            </div>

            <div className="bottom-sheet-actions">
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem' }}
                onClick={() => {
                  alert('Tính năng trừ buổi trực tiếp sẽ chuyển sang POS!');
                }}
              >
                Trừ buổi
              </button>
              <button 
                className="btn" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', background: '#f3f4f6', color: 'var(--text-main)', border: 'none' }}
                onClick={() => {
                  setEditCustomerPackageData({ total_sessions: selectedCustomerPackage.total_sessions });
                  setIsEditCustomerPackageModalOpen(true);
                }}
              >
                Chỉnh sửa
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT CUSTOMER PACKAGE MODAL */}
      {isEditCustomerPackageModalOpen && createPortal(
        <div className="fullscreen-sheet-mobile-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', margin: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Sửa số buổi liệu trình</h3>
            <form onSubmit={handleSaveCustomerPackageEdit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>Tổng số buổi</label>
                <input 
                  type="number" 
                  className="form-input" 
                  required 
                  min={selectedCustomerPackage?.used_sessions || 1}
                  value={editCustomerPackageData.total_sessions} 
                  onChange={(e) => setEditCustomerPackageData({ total_sessions: Number(e.target.value) })} 
                  style={{ height: '48px', borderRadius: '14px', fontSize: '16px', width: '100%' }} 
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>
                  Đã sử dụng: {selectedCustomerPackage?.used_sessions} buổi
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsEditCustomerPackageModalOpen(false)} className="btn" style={{ flex: 1, background: '#f3f4f6', color: 'var(--text-main)', border: 'none', height: '48px' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, height: '48px' }}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Packages;
