import { useState, useEffect } from 'react';
import { Search, Plus, Loader2, UserCircle, Phone, CreditCard, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Customers = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;
  const [activeTab, setActiveTab] = useState<'general' | 'packages'>('general');
  const [customers, setCustomers] = useState<any[]>([]);
  const [packageCustomers, setPackageCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (shopId) {
      if (activeTab === 'general') fetchCustomers();
      else fetchPackageCustomers();
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

  const fetchPackageCustomers = async () => {
    setLoading(true);
    const { data: cpData, error } = await supabase
      .from('customer_packages')
      .select('*')
      .eq('shop_id', shopId)
      .neq('status', 'archived')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    
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
      fetchPackageCustomers();
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
      fetchPackageCustomers();
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
        <div className="grid grid-cols-3">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <UserCircle size={28} />
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{customer.name}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <Phone size={14} />
                  {customer.phone || 'Chưa có SĐT'}
                </div>
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
              Không tìm thấy khách hàng phù hợp.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3">
          {filteredPackageCustomers.map((cp) => (
            <div key={cp.id} className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{cp.customer_name}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <Phone size={14} />
                    {cp.customer_phone || 'Chưa có SĐT'}
                  </div>
                </div>
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
              
              <div style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '0.5rem', opacity: (cp.status === 'cancelled' || cp.status === 'archived') ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                  <Package size={16} className="text-primary" />
                  {cp.packages?.name || 'Gói không xác định'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <CreditCard size={16} className="text-secondary" />
                  Mã thẻ: <strong>{cp.card_code || 'N/A'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span>Số buổi: <strong>{cp.total_sessions}</strong></span>
                  <span>Đã dùng: <strong style={{ color: 'var(--warning)' }}>{cp.used_sessions}</strong></span>
                </div>
                <div style={{ marginTop: '0.5rem', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(cp.used_sessions / cp.total_sessions) * 100}%`, height: '100%', background: 'var(--primary)' }}></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                {cp.used_sessions === 0 && cp.status !== 'cancelled' && (
                  <button onClick={() => handleUpdatePackageStatus(cp.id, 'cancelled')} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flex: 1, background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>Hủy thẻ</button>
                )}
                {cp.used_sessions > 0 && cp.status !== 'archived' && (
                  <button onClick={() => handleUpdatePackageStatus(cp.id, 'archived')} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flex: 1, background: 'var(--bg-main)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Lưu trữ</button>
                )}
                {profile?.role === 'super_admin' && (
                  <button onClick={() => handleHardDeletePackage(cp.id)} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--danger)' }}>Xóa vĩnh viễn</button>
                )}
              </div>
            </div>
          ))}
          {filteredPackageCustomers.length === 0 && (
            <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
              Không tìm thấy khách hàng liệu trình phù hợp.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Customers;
