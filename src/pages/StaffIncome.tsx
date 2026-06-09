import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Loader2, Plus, Calendar, Clock, DollarSign, FileText, User } from 'lucide-react';

const StaffIncome = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;

  const [staffs, setStaffs] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    staff_name: '',
    tip_amount: '',
    tour_amount: '',
    overtime_minutes: '',
    meal_amount: '',
    note: ''
  });

  // Filter State
  const [filterType, setFilterType] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStaffName, setFilterStaffName] = useState('');
  const [displayLimit, setDisplayLimit] = useState(10);

  useEffect(() => {
    if (shopId) {
      fetchStaffs();
    }
  }, [shopId]);

  useEffect(() => {
    if (shopId) {
      fetchIncomes();
    }
  }, [shopId, filterType, startDate, endDate, filterStaffName]);

  const fetchStaffs = async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from('staffs')
      .select('id, full_name')
      .eq('shop_id', shopId)
      .eq('status', 'active')
      .order('full_name');
    if (data) setStaffs(data);
  };

  const fetchIncomes = async () => {
    if (!shopId) return;
    setLoading(true);

    let query = supabase
      .from('staff_daily_income')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    // Áp dụng bộ lọc thời gian
    const now = new Date();
    if (filterType === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte('created_at', startOfDay);
    } else if (filterType === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Bắt đầu từ thứ 2
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      query = query.gte('created_at', startOfWeek.toISOString());
    } else if (filterType === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte('created_at', startOfMonth);
    } else if (filterType === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    }

    if (filterStaffName) {
      query = query.eq('staff_name', filterStaffName);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Lỗi lấy dữ liệu thu nhập:', error);
    } else {
      setIncomes(data || []);
      setDisplayLimit(10);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return alert('Lỗi: Không xác định được cửa hàng.');
    if (!formData.staff_name) return alert('Vui lòng chọn hoặc nhập tên nhân viên.');

    setSaving(true);
    const payload = {
      shop_id: shopId,
      staff_name: formData.staff_name,
      tip_amount: Number(formData.tip_amount) || 0,
      tour_amount: Number(formData.tour_amount) || 0,
      overtime_minutes: Number(formData.overtime_minutes) || 0,
      meal_amount: Number(formData.meal_amount) || 0,
      note: formData.note
    };

    const { error } = await supabase.from('staff_daily_income').insert([payload]);
    
    if (error) {
      alert('Lỗi khi lưu dữ liệu: ' + error.message);
    } else {
      alert('Đã lưu thành công!');
      setFormData({
        staff_name: '',
        tip_amount: '',
        tour_amount: '',
        overtime_minutes: '',
        meal_amount: '',
        note: ''
      });
      fetchIncomes();
    }
    setSaving(false);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="page-container animate-fade" style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="page-title" style={{ marginBottom: '1.5rem', fontSize: '1.5rem', textAlign: 'center' }}>Thu Nhập KTV</h1>

      {/* Form Nhập Liệu */}
      <div className="premium-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Ghi Nhận Mới</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div>
            <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} /> Chọn Nhân viên (KTV) <span className="text-danger">*</span>
            </label>
            <select 
              className="form-select" 
              required
              value={formData.staff_name}
              onChange={(e) => setFormData({...formData, staff_name: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
            >
              <option value="">-- Chọn nhân viên --</option>
              {staffs.map(s => (
                <option key={s.id} value={s.full_name}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={16} /> Tiền Tip
              </label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="VD: 50000"
                value={formData.tip_amount}
                onChange={(e) => setFormData({...formData, tip_amount: e.target.value})}
              />
            </div>
            
            <div>
              <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={16} /> Tiền Tour ngoài
              </label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="VD: 100000"
                value={formData.tour_amount}
                onChange={(e) => setFormData({...formData, tour_amount: e.target.value})}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} /> Phút làm thêm
              </label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="VD: 60"
                value={formData.overtime_minutes}
                onChange={(e) => setFormData({...formData, overtime_minutes: e.target.value})}
              />
            </div>
            
            <div>
              <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={16} /> Tiền ăn
              </label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="VD: 30000"
                value={formData.meal_amount}
                onChange={(e) => setFormData({...formData, meal_amount: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} /> Ghi chú
            </label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Nhập ghi chú (nếu có)..."
              value={formData.note}
              onChange={(e) => setFormData({...formData, note: e.target.value})}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={saving}
            style={{ width: '100%', padding: '0.875rem', marginTop: '0.5rem', fontWeight: 'bold' }}
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> Lưu Thu Nhập</>}
          </button>
        </form>
      </div>

      {/* Bộ Lọc */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
          <button onClick={() => setFilterType('today')} className="btn" style={{ flexShrink: 0, padding: '0.5rem 1rem', background: filterType === 'today' ? 'var(--primary)' : 'var(--bg-main)', color: filterType === 'today' ? 'white' : 'inherit', borderRadius: '2rem' }}>
            Hôm nay
          </button>
          <button onClick={() => setFilterType('this_week')} className="btn" style={{ flexShrink: 0, padding: '0.5rem 1rem', background: filterType === 'this_week' ? 'var(--primary)' : 'var(--bg-main)', color: filterType === 'this_week' ? 'white' : 'inherit', borderRadius: '2rem' }}>
            Tuần này
          </button>
          <button onClick={() => setFilterType('this_month')} className="btn" style={{ flexShrink: 0, padding: '0.5rem 1rem', background: filterType === 'this_month' ? 'var(--primary)' : 'var(--bg-main)', color: filterType === 'this_month' ? 'white' : 'inherit', borderRadius: '2rem' }}>
            Tháng này
          </button>
          <button onClick={() => setFilterType('custom')} className="btn" style={{ flexShrink: 0, padding: '0.5rem 1rem', background: filterType === 'custom' ? 'var(--primary)' : 'var(--bg-main)', color: filterType === 'custom' ? 'white' : 'inherit', borderRadius: '2rem' }}>
            Tùy chọn
          </button>
        </div>
        
        {filterType === 'custom' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ flex: 1 }} />
            <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ flex: 1 }} />
          </div>
        )}
      </div>

      {/* Danh sách Lịch sử dạng Mobile Card */}
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} className="text-primary" /> Lịch sử thu nhập
          </h3>
          <select 
            className="form-select" 
            value={filterStaffName}
            onChange={e => setFilterStaffName(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem', minWidth: '150px' }}
          >
            <option value="">Tất cả nhân viên</option>
            {staffs.map(s => (
              <option key={`filter-${s.id}`} value={s.full_name}>{s.full_name}</option>
            ))}
          </select>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin text-primary mx-auto" /></div>
        ) : incomes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-main)', borderRadius: '1rem', color: 'var(--text-light)' }}>
            Chưa có dữ liệu trong khoảng thời gian này
          </div>
        ) : (
          <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1rem' }}>Thời gian</th>
                    <th style={{ padding: '1rem' }}>Nhân viên</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Tiền Tip</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Tour ngoài</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Làm thêm</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Tiền ăn</th>
                    <th style={{ padding: '1rem' }}>Ghi chú</th>
                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)' }}>Tổng nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.slice(0, displayLimit).map(item => {
                    const totalAmount = Number(item.tip_amount || 0) + Number(item.tour_amount || 0) + Number(item.meal_amount || 0);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{formatDate(item.created_at)}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>{item.staff_name}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.tip_amount) > 0 ? formatMoney(item.tip_amount) : '-'}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.tour_amount) > 0 ? formatMoney(item.tour_amount) : '-'}</td>
                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: 'var(--warning)' }}>{Number(item.overtime_minutes) > 0 ? `${item.overtime_minutes}p` : '-'}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.meal_amount) > 0 ? formatMoney(item.meal_amount) : '-'}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.note}>{item.note || '-'}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>{formatMoney(totalAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {incomes.length > displayLimit && (
              <div style={{ padding: '1rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                <button 
                  onClick={() => setDisplayLimit(prev => prev + 10)} 
                  className="btn" 
                  style={{ background: 'var(--bg-main)', color: 'var(--primary)', fontWeight: '600', padding: '0.5rem 1.5rem', borderRadius: '2rem' }}
                >
                  Xem thêm {Math.min(10, incomes.length - displayLimit)} hàng
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default StaffIncome;
