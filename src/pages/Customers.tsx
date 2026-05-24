import { useState, useEffect } from 'react';
import { Search, Plus, Loader2, UserCircle, Phone, CreditCard, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Customers = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;
  const [activeTab, setActiveTab] = useState<'general' | 'packages' | 'archived'>('general');
  const [customers, setCustomers] = useState<any[]>([]);
  const [packageCustomers, setPackageCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (shopId) {
      if (activeTab === 'general') fetchCustomers();
      else fetchPackageCustomers(activeTab === 'archived' ? 'archived' : 'active');
    } else if (profile?.role === 'super_admin') {
      setLoading(false);
    }
  }, [shopId, profile, activeTab]);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  };

  const fetchPackageCustomers = async (type: 'active' | 'archived') => {
    setLoading(true);
    let query = supabase
      .from('customer_packages')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (type === 'active') {
      query = query.neq('status', 'archived').neq('status', 'cancelled');
    } else {
      query = query.in('status', ['archived', 'cancelled']);
    }

    const { data: cpData, error } = await query;
    
    if (error) {
      console.error('Error fetching package customers:', error);
      setPackageCustomers([]);
      setLoading(false);
      return;
    }
    
    if (cpData && cpData.length > 0) {
      const packageIds = [...new Set(cpData.map(cp => cp.package_id).filter(Boolean))];
      let packagesData: any[] = [];
      if (packageIds.length > 0) {
        const { data: pkgs } = await supabase.from('packages')
          .select('id, name')
          .in('id', packageIds);
        if (pkgs) packagesData = pkgs;
      }
      
      const finalData = cpData.map(cp => ({
        ...cp,
        packages: packagesData.find(p => p.id === cp.package_id) || { name: 'Gói không xác định' }
      }));
      setPackageCustomers(finalData);
    } else {
      setPackageCustomers([]);
    }
    
    setLoading(false);
  };

  const handleAddCustomer = async () => {
    if (isRestricted()) {
      alert('Vui lòng gia hạn gói dịch vụ!');
      return;
    }
    if (!shopId) {
      alert('Lỗi: Super Admin không thể tạo khách hàng.');
      return;
    }

    const name = window.prompt('Nhập tên khách hàng mới:');
    if (!name?.trim()) return;

    const phone = window.prompt('Nhập số điện thoại (có thể bỏ qua):');

    const { error } = await supabase.from('customers').insert([{ shop_id: shopId, name: name.trim(), phone: phone?.trim() || null }]);
    if (error) {
      alert('Lỗi khi thêm khách: ' + error.message);
    } else {
      fetchCustomers();
    }
  };

  const handleUpdatePackageStatus = async (cpId: string, newStatus: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển trạng thái thẻ này thành: ${newStatus}?`)) return;
    
    setLoading(true);
    const { error } = await supabase.from('customer_packages').update({ status: newStatus }).eq('id', cpId);
    if (!error) {
      fetchPackageCustomers(activeTab === 'archived' ? 'archived' : 'active');
    } else {
      alert('Lỗi cập nhật: ' + error.message);
      setLoading(false);
    }
  };

  const handleHardDeletePackage = async (cpId: string) => {
    if (profile?.role !== 'super_admin') return;
    if (!window.confirm('XÓA VĨNH VIỄN thẻ liệu trình này? Hành động DÀNH CHO SUPER ADMIN để xóa data test và KHÔNG THỂ HOÀN TÁC.')) return;
    
    setLoading(true);
    const { error } = await supabase.from('customer_packages').delete().eq('id', cpId);
    if (!error) {
      fetchPackageCustomers(activeTab === 'archived' ? 'archived' : 'active');
    } else {
      alert('Lỗi xóa cứng: ' + error.message);
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term)
    );
  });

  const filteredPackageCustomers = packageCustomers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.customer_name || '').toLowerCase().includes(term) ||
      (c.customer_phone || '').includes(term) ||
      (c.card_code || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Khách hàng</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Lưu trữ thông tin và lịch sử dịch vụ của khách</p>
        </div>
        {activeTab === 'general' && (
          <button className="btn btn-primary" disabled={isRestricted()} onClick={handleAddCustomer}>
            <Plus size={18} /> Thêm Khách hàng
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setActiveTab('general')} className="btn" style={{ background: activeTab === 'general' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'general' ? 'white' : 'inherit' }}>
          <UserCircle size={18} /> Khách vãng lai / Đăng ký
        </button>
        <button onClick={() => setActiveTab('packages')} className="btn" style={{ background: activeTab === 'packages' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'packages' ? 'white' : 'inherit' }}>
          <Package size={18} /> Khách hàng liệu trình
        </button>
        <button onClick={() => setActiveTab('archived')} className="btn" style={{ background: activeTab === 'archived' ? 'var(--primary)' : 'var(--bg-main)', color: activeTab === 'archived' ? 'white' : 'inherit' }}>
          <CreditCard size={18} /> Đã lưu trữ
        </button>
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Tìm theo tên hoặc số điện thoại..." 
            style={{ paddingLeft: '2.75rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /></div>
      ) : activeTab === 'general' ? (
        <div className="premium-card table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Khách hàng</th>
                <th>Số điện thoại</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(109, 40, 217, 0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                        <UserCircle size={24} />
                      </div>
                      <span style={{ fontWeight: '600', fontSize: '1rem' }}>{customer.name}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Phone size={16} />
                      {customer.phone || 'Chưa có SĐT'}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {new Date(customer.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Không tìm thấy khách hàng phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="premium-card table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Khách hàng</th>
                <th>Thông tin thẻ</th>
                <th>Gói dịch vụ</th>
                <th>Tiến độ sử dụng</th>
                <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackageCustomers.map((cp) => (
                <tr key={cp.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem', opacity: (cp.status === 'cancelled' || cp.status === 'archived') ? 0.6 : 1, transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(109, 40, 217, 0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>{cp.customer_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <Phone size={14} />
                      {cp.customer_phone || 'Chưa có SĐT'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <CreditCard size={16} className="text-secondary" />
                      Mã: <strong>{cp.card_code || 'N/A'}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem' }}>
                      {cp.status === 'completed' ? (
                        <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-light)', border: '1px solid var(--border)' }}>Hết buổi</span>
                      ) : cp.status === 'cancelled' ? (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>Đã hủy</span>
                      ) : cp.status === 'archived' ? (
                        <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-light)' }}>Đã lưu trữ</span>
                      ) : (
                        <span className="badge badge-success">Đang dùng</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      <Package size={16} className="text-primary" />
                      {cp.packages?.name || 'Gói không xác định'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Mua: {new Date(cp.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      <span>Tổng: <strong>{cp.total_sessions}</strong></span>
                      <span>Đã dùng: <strong style={{ color: 'var(--warning)' }}>{cp.used_sessions}</strong></span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(cp.used_sessions / cp.total_sessions) * 100}%`, height: '100%', background: 'var(--primary)' }}></div>
                    </div>
                  </td>
                  <td style={{ paddingRight: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {cp.used_sessions === 0 && cp.status !== 'cancelled' && (
                        <button onClick={() => handleUpdatePackageStatus(cp.id, 'cancelled')} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>Hủy thẻ</button>
                      )}
                      {cp.used_sessions > 0 && cp.status !== 'archived' && (
                        <button onClick={() => handleUpdatePackageStatus(cp.id, 'archived')} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Lưu trữ</button>
                      )}
                      {(cp.status === 'archived' || cp.status === 'cancelled') && (
                        <button onClick={() => handleUpdatePackageStatus(cp.id, 'active')} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid var(--success)' }}>Khôi phục</button>
                      )}
                      {profile?.role === 'super_admin' && (
                        <button onClick={() => handleHardDeletePackage(cp.id)} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--danger)' }}>Xóa vĩnh viễn</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPackageCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Không tìm thấy khách hàng liệu trình phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Customers;
