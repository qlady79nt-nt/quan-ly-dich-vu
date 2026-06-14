import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Scissors, Trash2, Edit2, Loader2, DollarSign, Percent, Folder, ChevronRight, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Services = () => {
  const { profile, isRestricted } = useAuth();
  const shopId = profile?.shop_id;

  const [activeTab, setActiveTab] = useState<'all' | 'groups'>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [services, setServices] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    duration_minutes: 60,
    commission_type: 'percent',
    commission_value: 0,
    status: 'active',
    service_group_id: ''
  });

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    sort_order: 0
  });

  useEffect(() => {
    if (profile) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    
    let servicesQuery = supabase.from('services').select('*').order('created_at', { ascending: false });
    let groupsQuery = supabase.from('service_groups').select('*').order('sort_order', { ascending: true });
    
    if (profile?.role !== 'super_admin') {
      if (!shopId) {
        setLoading(false);
        return;
      }
      servicesQuery = servicesQuery.eq('shop_id', shopId);
      groupsQuery = groupsQuery.eq('shop_id', shopId);
    }

    const [servicesRes, groupsRes] = await Promise.all([servicesQuery, groupsQuery]);
    
    if (!servicesRes.error) setServices(servicesRes.data || []);
    if (!groupsRes.error) setGroups(groupsRes.data || []);
    
    setLoading(false);
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    
    if (editingGroupId) {
      const { error } = await supabase.from('service_groups').update(groupFormData).eq('id', editingGroupId);
      if (!error) {
        fetchData();
        setIsGroupModalOpen(false);
      } else {
        alert('Lỗi: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('service_groups').insert([{ ...groupFormData, shop_id: shopId }]);
      if (!error) {
        fetchData();
        setIsGroupModalOpen(false);
      } else {
        alert('Lỗi: ' + error.message);
      }
    }
    setSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    
    const submitData = {
      ...formData,
      service_group_id: formData.service_group_id || null,
      shop_id: shopId
    };
    
    if (editingId) {
      const { error } = await supabase.from('services').update(submitData).eq('id', editingId);
      if (!error) {
        fetchData();
        setIsModalOpen(false);
      } else alert('Lỗi: ' + error.message);
    } else {
      const { error } = await supabase.from('services').insert([submitData]);
      if (!error) {
        fetchData();
        setIsModalOpen(false);
      } else alert('Lỗi: ' + error.message);
    }
    setSaving(false);
  };

  const handleToggleStatus = async (s: any) => {
    if (isRestricted()) return alert('Vui lòng gia hạn!');
    const isInactive = s.status === 'inactive';
    if (!window.confirm(`Bạn muốn ${isInactive ? 'Bán lại' : 'Ngưng bán'} dịch vụ này?`)) return;
    setLoading(true);
    const { error } = await supabase.from('services').update({ status: isInactive ? 'active' : 'inactive' }).eq('id', s.id);
    if (!error) fetchData();
    else { alert('Lỗi: ' + error.message); setLoading(false); }
  };

  const handleHardDeleteGroup = async (id: string) => {
    if (profile?.role !== 'super_admin' && profile?.role !== 'shop_admin') return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhóm này?')) return;
    setLoading(true);
    const { error } = await supabase.from('service_groups').delete().eq('id', id);
    if (!error) fetchData();
    else { alert('Lỗi: ' + error.message); setLoading(false); }
  };

  const handleHardDelete = async (id: string) => {
    if (profile?.role !== 'super_admin') return;
    if (!window.confirm('XÓA VĨNH VIỄN dịch vụ này?')) return;
    setLoading(true);
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (!error) fetchData();
    else { alert('Lỗi: ' + error.message); setLoading(false); }
  };

  const renderServicesList = (serviceList: any[]) => {
    return serviceList.map(s => {
      const isInactive = s.status === 'inactive';
      const isGrouped = !!s.service_group_id;
      
      const iconBg = isInactive ? 'rgba(0,0,0,0.05)' : (isGrouped ? 'rgba(109, 40, 217, 0.08)' : 'rgba(234, 88, 12, 0.08)');
      const iconColor = isInactive ? 'var(--text-light)' : (isGrouped ? 'var(--primary)' : '#ea580c'); // #ea580c is an orange color
      
      return (
      <div key={s.id} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', opacity: isInactive ? 0.6 : 1, transition: 'opacity 0.2s', marginBottom: '1rem' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
          <Scissors size={28} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '1.1rem', textDecoration: s.status === 'inactive' ? 'line-through' : 'none', margin: 0 }}>{s.name}</h4>
            {s.status === 'inactive' && <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-light)', border: '1px solid var(--border)' }}>NGƯNG BÁN</span>}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: s.status === 'inactive' ? 'var(--text-secondary)' : 'var(--primary)', fontWeight: '700' }}>
              {Number(s.price).toLocaleString()}đ
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
              ⏱ {s.duration_minutes} phút
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {profile?.role === 'shop_admin' && (
            <button onClick={() => {
              setEditingId(s.id);
              setFormData({ name: s.name, price: s.price, duration_minutes: s.duration_minutes, commission_type: s.commission_type || 'percent', commission_value: s.commission_value || 0, status: s.status, service_group_id: s.service_group_id || '' });
              setIsModalOpen(true);
            }} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)' }}><Edit2 size={16} /></button>
          )}
          {profile?.role === 'shop_admin' && (
            <button onClick={() => handleToggleStatus(s)} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: s.status === 'inactive' ? 'var(--success)' : 'var(--text-light)', border: '1px solid var(--border)' }}>
              {s.status === 'inactive' ? 'Bán lại' : 'Ngưng bán'}
            </button>
          )}
          {profile?.role === 'super_admin' && (
            <button onClick={() => handleHardDelete(s.id)} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--danger)' }} title="Xóa cứng (Super Admin)"><Trash2 size={16} /></button>
          )}
        </div>
      </div>
      );
    });
  };

  const filteredAllServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const drillDownGroup = groups.find(g => g.id === selectedGroupId);
  const groupServices = services.filter(s => s.service_group_id === selectedGroupId && s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="page-container animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Quản lý Dịch vụ</h1>
          <p className="page-subtitle">Thiết lập bảng giá và phân nhóm dịch vụ</p>
        </div>
        {profile?.role === 'shop_admin' && !selectedGroupId && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => { setEditingGroupId(null); setGroupFormData({ name: '', sort_order: 0 }); setIsGroupModalOpen(true); }} className="btn btn-secondary">
              <Plus size={18} /> Tạo nhóm
            </button>
            <button onClick={() => { setEditingId(null); setFormData({ name: '', price: 0, duration_minutes: 60, commission_type: 'percent', commission_value: 0, status: 'active', service_group_id: '' }); setIsModalOpen(true); }} className="btn btn-primary" disabled={isRestricted()}>
              <Plus size={18} /> Tạo dịch vụ
            </button>
          </div>
        )}
        {profile?.role === 'shop_admin' && selectedGroupId && (
          <button onClick={() => { setEditingId(null); setFormData({ name: '', price: 0, duration_minutes: 60, commission_type: 'percent', commission_value: 0, status: 'active', service_group_id: selectedGroupId }); setIsModalOpen(true); }} className="btn btn-primary" disabled={isRestricted()}>
            <Plus size={18} /> Thêm dịch vụ vào nhóm
          </button>
        )}
      </div>

      {!selectedGroupId && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <button className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('all')}>Tất cả</button>
          <button className={`btn ${activeTab === 'groups' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('groups')}>Nhóm dịch vụ</button>
        </div>
      )}

      {selectedGroupId && drillDownGroup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setSelectedGroupId(null)}><ArrowLeft size={18} /> Quay lại</button>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, textTransform: 'uppercase', color: 'var(--text-main)' }}>{drillDownGroup.name}</h2>
        </div>
      )}

      <div className="premium-card mobile-stack" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', flex: 1, width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input type="text" className="form-input" placeholder={activeTab === 'groups' && !selectedGroupId ? "Tìm nhóm..." : "Tìm dịch vụ..."} style={{ paddingLeft: '2.75rem', width: '100%' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" /> Đang tải...</div>
      ) : (
        <>
          {activeTab === 'all' && !selectedGroupId && (
            <div>{renderServicesList(filteredAllServices)}</div>
          )}

          {activeTab === 'groups' && !selectedGroupId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase())).map(g => (
                <div key={g.id} className="premium-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setSelectedGroupId(g.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      <Folder size={24} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{g.name}</h4>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{services.filter(s => s.service_group_id === g.id).length} dịch vụ</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {profile?.role === 'shop_admin' && (
                      <button onClick={(e) => { e.stopPropagation(); setEditingGroupId(g.id); setGroupFormData({ name: g.name, sort_order: g.sort_order }); setIsGroupModalOpen(true); }} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)' }}><Edit2 size={16} /></button>
                    )}
                    {(profile?.role === 'super_admin' || profile?.role === 'shop_admin') && (
                      <button onClick={(e) => { e.stopPropagation(); handleHardDeleteGroup(g.id); }} className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--danger)' }}><Trash2 size={16} /></button>
                    )}
                    <ChevronRight size={20} color="var(--text-light)" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedGroupId && (
            <div>
              {groupServices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>Nhóm này chưa có dịch vụ nào.</div>
              ) : renderServicesList(groupServices)}
            </div>
          )}
        </>
      )}

      {/* Group Modal */}
      {isGroupModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>{editingGroupId ? 'Cập nhật Nhóm' : 'Tạo Nhóm Dịch Vụ'}</h3>
            <form onSubmit={handleGroupSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Tên nhóm</label>
                <input type="text" className="form-input" required value={groupFormData.name} onChange={e => setGroupFormData({...groupFormData, name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Thứ tự hiển thị (Sort Order)</label>
                <input type="number" className="form-input" value={groupFormData.sort_order} onChange={e => setGroupFormData({...groupFormData, sort_order: Number(e.target.value)})} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Số càng nhỏ hiện càng lên trên (VD: 1, 2, 3...)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsGroupModalOpen(false)} className="btn btn-secondary">Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Service Modal */}
      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="premium-card animate-fade" style={{ width: '100%', maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Cập nhật dịch vụ' : 'Thiết lập dịch vụ mới'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Tên dịch vụ</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Thuộc nhóm</label>
                  <select className="form-select" value={formData.service_group_id} onChange={e => setFormData({...formData, service_group_id: e.target.value})}>
                    <option value="">-- Không thuộc nhóm nào --</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá dịch vụ (đ)</label>
                  <input type="number" className="form-input" required value={formData.price || ''} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Thời gian (phút)</label>
                  <input type="number" className="form-input" required value={formData.duration_minutes || ''} onChange={(e) => setFormData({...formData, duration_minutes: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Loại hoa hồng</label>
                  <select className="form-select" value={formData.commission_type} onChange={(e) => setFormData({...formData, commission_type: e.target.value})}>
                    <option value="percent">Theo % (Phần trăm)</option>
                    <option value="fixed">Theo tiền (Cố định)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600' }}>Giá trị hoa hồng</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" className="form-input" required value={formData.commission_value || ''} onChange={(e) => setFormData({...formData, commission_value: Number(e.target.value)})} />
                    <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}>
                      {formData.commission_type === 'percent' ? <Percent size={14} /> : <DollarSign size={14} />}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                    {formData.commission_type === 'percent' ? 'Nhập số từ 1-100' : 'Nhập số tiền mặt'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="btn" style={{ background: 'var(--border)' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : (editingId ? 'Cập nhật' : 'Lưu dịch vụ')}
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

export default Services;
