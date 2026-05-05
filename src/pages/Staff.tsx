import { useState, useEffect } from 'react';
import { Plus, Search, UserPlus, Trash2, Edit2, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const Staff = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    role: 'staff',
    staff_type: 'both',
    status: 'active'
  });

  useEffect(() => {
    if (shopId) fetchStaff();
  }, [shopId]);

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (!error) setStaff(data || []);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Note: In a real Supabase app, we'd use an edge function to create Auth users.
    // For this demo/prototype, we'll just insert into profiles if we have the ID,
    // or assume we're creating 'profile placeholders' for now.
    const { error } = await supabase
      .from('profiles')
      .insert([{ ...formData, shop_id: shopId }]);

    if (!error) {
      fetchStaff();
      setIsModalOpen(false);
      setFormData({ full_name: '', username: '', role: 'staff', staff_type: 'both', status: 'active' });
    } else {
      alert('Lỗi khi tạo nhân viên: ' + error.message);
    }
    setSaving(false);
  };

  const filteredStaff = staff.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Quản lý Nhân viên</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Quản lý đội ngũ kỹ thuật viên và nhân viên bán hàng</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <UserPlus size={18} />
          Thêm nhân viên
        </button>
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Tìm theo tên hoặc tên đăng nhập..." 
            style={{ paddingLeft: '2.75rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /> Đang tải...</div>
      ) : (
        <div className="grid grid-cols-3">
          {filteredStaff.map((s) => (
            <div key={s.id} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                {s.full_name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ marginBottom: '0.25rem' }}>{s.full_name}</h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="badge badge-primary">{s.role}</span>
                  <span className="badge badge-success">{s.staff_type}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)' }}><Edit2 size={16} /></button>
                <button className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--danger)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Placeholder */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Thêm nhân viên mới</h3>
            <form onSubmit={handleCreate}>
              <div className="grid" style={{ gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Họ và tên</label>
                  <input type="text" className="form-input" required value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Vai trò</label>
                  <select className="form-select" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as any})}>
                    <option value="staff">Nhân viên</option>
                    <option value="manager">Quản lý</option>
                    <option value="shop_admin">Admin Cửa hàng</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Loại nhân viên</label>
                  <select className="form-select" value={formData.staff_type} onChange={(e) => setFormData({...formData, staff_type: e.target.value})}>
                    <option value="technician">Kỹ thuật viên (Làm dịch vụ)</option>
                    <option value="sales">Tư vấn viên (Bán gói)</option>
                    <option value="both">Cả hai</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Lưu nhân viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
