import { useState, useEffect } from 'react';
import { Search, Plus, Loader2, UserCircle, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Customers = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (shopId) {
      fetchCustomers();
    } else if (profile?.role === 'super_admin') {
      setLoading(false);
    }
  }, [shopId, profile]);

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

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Khách hàng</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Lưu trữ thông tin và lịch sử dịch vụ của khách</p>
        </div>
        <button className="btn btn-primary" disabled={isRestricted()} onClick={handleAddCustomer}>
          <Plus size={18} /> Thêm Khách hàng
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
      ) : (
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
      )}
    </div>
  );
};

export default Customers;
