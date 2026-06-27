import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Loader2, Plus, Calendar, Clock, DollarSign, FileText, User } from 'lucide-react';

const StaffIncome = () => {
  const { profile } = useAuth();
  const shopId = profile?.shop_id;
  const isShopAdmin = profile?.role === 'shop_admin' || profile?.role === 'super_admin';

  const [staffs, setStaffs] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input');

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

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      staff_name: '', tip_amount: '', tour_amount: '', overtime_minutes: '', meal_amount: '', note: ''
    });
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      staff_name: item.staff_name || '',
      tip_amount: item.tip_amount?.toString() || '',
      tour_amount: item.tour_amount?.toString() || '',
      overtime_minutes: item.overtime_minutes?.toString() || '',
      meal_amount: item.meal_amount?.toString() || '',
      note: item.note || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) return;
    setLoading(true);
    const { error } = await supabase.from('staff_daily_income').delete().eq('id', id);
    if (error) {
      alert('Lỗi khi xóa: ' + error.message);
    } else {
      fetchIncomes();
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

    if (!editingId) {
      // Kiểm tra xem nhân viên đã có bản ghi trong ngày hôm nay chưa
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      const { data: existing, error: checkErr } = await supabase
        .from('staff_daily_income')
        .select('id')
        .eq('shop_id', shopId)
        .eq('staff_name', formData.staff_name)
        .gte('created_at', startOfDay)
        .limit(1);
        
      if (checkErr) {
        setSaving(false);
        return alert('Lỗi kiểm tra dữ liệu: ' + checkErr.message);
      }
      
      if (existing && existing.length > 0) {
        setSaving(false);
        return alert(`Nhân viên ${formData.staff_name} đã được ghi nhận thu nhập trong hôm nay!\nNếu sai sót, vui lòng báo cho Quản Lý để chỉnh sửa.`);
      }

      const { error } = await supabase.from('staff_daily_income').insert([payload]);
      if (error) {
        alert('Lỗi khi lưu dữ liệu: ' + error.message);
      } else {
        alert('Đã lưu thành công!');
        resetForm();
        fetchIncomes();
      }
    } else {
      if (!isShopAdmin) {
        setSaving(false);
        return alert('Chỉ có Quản Lý (Shop Admin) mới được phép chỉnh sửa thu nhập đã ghi nhận trong ngày!');
      }
      
      const { error } = await supabase.from('staff_daily_income').update(payload).eq('id', editingId);
      if (error) {
        alert('Lỗi cập nhật: ' + error.message);
      } else {
        alert('Cập nhật thành công!');
        resetForm();
        fetchIncomes();
      }
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

  const totalTip = incomes.reduce((sum, item) => sum + (Number(item.tip_amount) || 0), 0);
  const totalTour = incomes.reduce((sum, item) => sum + (Number(item.tour_amount) || 0), 0);
  const totalMeal = incomes.reduce((sum, item) => sum + (Number(item.meal_amount) || 0), 0);
  const totalOvertime = incomes.reduce((sum, item) => sum + (Number(item.overtime_minutes) || 0), 0);

  return (
    <div className="page-container animate-fade" style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 className="page-title" style={{ marginBottom: '1rem', fontSize: '1.5rem', textAlign: 'center' }}>Thu Nhập KTV</h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <button 
          onClick={() => setActiveTab('input')}
          style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'input' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'input' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
        >
          Ghi nhận
        </button>
        <button 
          onClick={() => { setActiveTab('history'); fetchIncomes(); }}
          style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'history' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
        >
          Lịch sử
        </button>
      </div>

      {activeTab === 'input' && (
      <div className="premium-card animate-fade" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          {editingId ? 'Cập Nhật Thu Nhập' : 'Ghi Nhận Mới'}
        </h3>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            {editingId && (
              <button 
                type="button" 
                onClick={resetForm}
                className="btn" 
                style={{ flex: 1, padding: '0.875rem', fontWeight: 'bold', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Hủy
              </button>
            )}
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={saving}
              style={{ flex: 2, padding: '0.875rem', fontWeight: 'bold' }}
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> {editingId ? 'Lưu Thay Đổi' : 'Lưu Thu Nhập'}</>}
            </button>
          </div>
        </form>
      </div>
      )}

      {activeTab === 'history' && (
      <div className="animate-fade">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          <div className="premium-card" style={{ padding: '0.5rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
            <DollarSign className="text-primary" size={16} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Tổng Tip</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)' }}>{formatMoney(totalTip)}</div>
          </div>
          <div className="premium-card" style={{ padding: '0.5rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
            <DollarSign className="text-success" size={16} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Tour Ngoài</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--success)' }}>{formatMoney(totalTour)}</div>
          </div>
          <div className="premium-card" style={{ padding: '0.5rem', textAlign: 'center', background: 'rgba(245, 158, 11, 0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
            <DollarSign className="text-warning" size={16} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Tiền Ăn</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--warning)' }}>{formatMoney(totalMeal)}</div>
          </div>
          <div className="premium-card" style={{ padding: '0.5rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
            <Clock className="text-danger" size={16} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Làm Thêm</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--danger)' }}>{totalOvertime > 0 ? `${totalOvertime}p` : '0p'}</div>
          </div>
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
          <>
            {/* Responsive Dense Table for both PC and Mobile */}
            <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-main)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Thời gian</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Nhân viên</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Tiền Tip</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Tour ngoài</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>Làm thêm</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Tiền ăn</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Ghi chú</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--success)' }}>Tổng nhận</th>
                      {isShopAdmin && <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {incomes.slice(0, displayLimit).map(item => {
                      const totalAmount = Number(item.tip_amount || 0) + Number(item.tour_amount || 0) + Number(item.meal_amount || 0);
                      const isEvenDay = new Date(item.created_at).getDate() % 2 === 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8rem', background: isEvenDay ? 'var(--bg-main)' : 'transparent' }} className="hover-row">
                          <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-secondary)' }}>{formatDate(item.created_at)}</td>
                          <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{item.staff_name}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.tip_amount) > 0 ? formatMoney(item.tip_amount) : '-'}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.tour_amount) > 0 ? formatMoney(item.tour_amount) : '-'}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: '600', color: 'var(--warning)' }}>{Number(item.overtime_minutes) > 0 ? `${item.overtime_minutes}p` : '-'}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.meal_amount) > 0 ? formatMoney(item.meal_amount) : '-'}</td>
                          <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.note}>{item.note || '-'}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>{formatMoney(totalAmount)}</td>
                          {isShopAdmin && (
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => { handleEdit(item); setActiveTab('input'); }} className="btn" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}>Sửa</button>
                                <button onClick={() => handleDelete(item.id)} className="btn" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>Xóa</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
          </>
        )}
      </div>
      </div>
      )}

    </div>
  );
};

export default StaffIncome;
