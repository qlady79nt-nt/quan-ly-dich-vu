import { useState, useEffect } from 'react';
import { Activity, Plus, Trash2, Loader2, Edit2, Check, X, Crown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Plan {
  id: string;
  name: string;
  max_users: number;
  max_branches: number;
  price: number;
}

const SuperAdminPlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', max_users: 5, max_branches: 1, price: 0 });
  const [editForm, setEditForm] = useState<Partial<Plan>>({});

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    const { data } = await supabase.from('plans').select('*').order('price', { ascending: true });
    setPlans(data || []);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('plans').insert(form);
      if (error) throw error;
      setForm({ name: '', max_users: 5, max_branches: 1, price: 0 });
      fetchPlans();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleStartEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditForm({ name: plan.name, max_users: plan.max_users, max_branches: plan.max_branches, price: plan.price });
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('plans').update(editForm).eq('id', id);
      if (error) throw error;
      setEditingId(null);
      fetchPlans();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Xoá gói "${plan.name}"? Các shop đang dùng gói này sẽ bị ảnh hưởng!`)) return;
    const { error } = await supabase.from('plans').delete().eq('id', plan.id);
    if (error) return alert('Lỗi: ' + error.message);
    fetchPlans();
  };

  const tierColors = [
    { bg: 'rgba(156,163,175,0.1)', border: '#9ca3af', badge: '#6b7280' },
    { bg: 'rgba(109,40,217,0.08)', border: 'var(--primary-color)', badge: 'var(--primary-color)' },
    { bg: 'rgba(212,175,55,0.1)', border: 'var(--secondary-color)', badge: 'var(--secondary-color)' },
    { bg: 'rgba(16,185,129,0.08)', border: 'var(--success-color)', badge: 'var(--success-color)' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>Quản lý Gói Dịch Vụ (Plans)</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Tạo và chỉnh sửa các gói dịch vụ cho khách hàng SaaS.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '2rem' }}>
        {/* FORM TẠO */}
        <div className="premium-card" style={{ alignSelf: 'start' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', fontSize: '1.1rem' }}>
            <Plus size={22} /> Tạo Gói Mới
          </h2>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Tên gói *</label>
              <input className="form-input" placeholder="VD: Free, Basic, Pro" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Max nhân viên</label>
                <input type="number" className="form-input" min={1} value={form.max_users} onChange={e => setForm({ ...form, max_users: Number(e.target.value) })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Max chi nhánh</label>
                <input type="number" className="form-input" min={1} value={form.max_branches} onChange={e => setForm({ ...form, max_branches: Number(e.target.value) })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Giá (VNĐ/năm) — 0 = Miễn phí</label>
              <input type="number" className="form-input" min={0} step={10000} value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} required />
            </div>
            <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              {saving ? 'Đang lưu...' : 'Tạo gói'}
            </button>
          </form>
        </div>

        {/* DANH SÁCH GÓI */}
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--primary-color)' }}>
              <Loader2 size={32} className="animate-spin" style={{ display: 'inline' }} />
            </div>
          ) : plans.length === 0 ? (
            <div className="premium-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <Activity size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ color: 'var(--text-light)' }}>Chưa có gói nào. Hãy tạo gói đầu tiên!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {plans.map((plan, idx) => {
                const colors = tierColors[Math.min(idx, tierColors.length - 1)];
                const isEditing = editingId === plan.id;
                return (
                  <div key={plan.id} className="premium-card" style={{ borderLeft: `4px solid ${colors.border}`, background: colors.bg }}>
                    {isEditing ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Tên gói</label>
                            <input className="form-input" style={{ padding: '0.5rem' }} value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Max NV</label>
                            <input type="number" className="form-input" style={{ padding: '0.5rem' }} value={editForm.max_users || 0} onChange={e => setEditForm({ ...editForm, max_users: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Max CN</label>
                            <input type="number" className="form-input" style={{ padding: '0.5rem' }} value={editForm.max_branches || 0} onChange={e => setEditForm({ ...editForm, max_branches: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Giá (đ/năm)</label>
                            <input type="number" className="form-input" style={{ padding: '0.5rem' }} value={editForm.price || 0} onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingId(null)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                            <X size={16} /> Huỷ
                          </button>
                          <button onClick={() => handleSaveEdit(plan.id)} disabled={saving} className="btn-primary" style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Lưu
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Crown size={28} color={colors.border} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '1.2rem' }}>{plan.name}</strong>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: colors.border }}>
                              {plan.price === 0 ? 'Miễn phí' : plan.price.toLocaleString('vi-VN') + 'đ/năm'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span>👤 Tối đa {plan.max_users} nhân viên</span>
                            <span>🏢 Tối đa {plan.max_branches} chi nhánh</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleStartEdit(plan)} style={{ background: 'rgba(109,40,217,0.1)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', color: 'var(--primary-color)', display: 'flex', alignItems: 'center' }}>
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => handleDelete(plan)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', color: 'var(--danger-color)', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPlans;
