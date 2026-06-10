import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Edit } from 'lucide-react';
import Calculator from './Calculator';

interface ReconciliationRecord {
  id: string;
  reconciliation_date: string;
  software_revenue: number;
  actual_cash: number;
  actual_transfer: number;
  difference: number;
  note: string;
}

interface Props {
  shopId: string;
  userId: string;
  onClose: () => void;
}

const ReconciliationModal: React.FC<Props> = ({ shopId, userId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  
  // Form State
  const [reconDate, setReconDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [softwareRevenue, setSoftwareRevenue] = useState(0);
  const [actualCash, setActualCash] = useState<number | ''>('');
  const [actualTransfer, setActualTransfer] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [activeCalcField, setActiveCalcField] = useState<'cash' | 'transfer' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // History State
  const [history, setHistory] = useState<ReconciliationRecord[]>([]);
  const [fromDate, setFromDate] = useState<string>(
    new Date(new Date().setDate(1)).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (activeTab === 'form') {
      fetchSoftwareRevenue(reconDate);
    } else {
      fetchHistory();
    }
  }, [activeTab, reconDate, fromDate, toDate]);

  const fetchSoftwareRevenue = async (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const startObj = new Date(y, m - 1, d, 0, 0, 0);
      const endObj = new Date(y, m - 1, d, 23, 59, 59, 999);
      const start = startObj.toISOString();
      const end = endObj.toISOString();

      const { data: revLog } = await supabase
        .from('revenue_logs')
        .select('amount, type')
        .eq('shop_id', shopId)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .neq('status', 'cancelled');

      if (revLog) {
        const retailRev = revLog.filter((r: any) => r.type === 'retail' || r.type === 'combo').reduce((acc: number, r: any) => acc + Number(r.amount), 0);
        const packageSaleCash = revLog.filter((r: any) => r.type === 'package_sale').reduce((acc: number, r: any) => acc + Number(r.amount), 0);
        const totalCashFlow = retailRev + packageSaleCash;
        setSoftwareRevenue(totalCashFlow);
      } else {
        setSoftwareRevenue(0);
      }
    } catch (error) {
      console.error('Lỗi tính doanh thu phần mềm:', error);
      setSoftwareRevenue(0);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('revenue_reconciliations')
        .select('*')
        .eq('shop_id', shopId)
        .gte('reconciliation_date', fromDate)
        .lte('reconciliation_date', toDate)
        .order('reconciliation_date', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (e: any) {
      console.error('Lỗi tải lịch sử:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCash === '' || actualTransfer === '') {
      alert('Vui lòng nhập tiền mặt và chuyển khoản!');
      return;
    }

    setIsSaving(true);
    const totalActual = Number(actualCash) + Number(actualTransfer);
    const difference = totalActual - softwareRevenue;

    const payload = {
      shop_id: shopId,
      reconciliation_date: reconDate,
      software_revenue: softwareRevenue,
      actual_cash: Number(actualCash),
      actual_transfer: Number(actualTransfer),
      difference,
      note,
      created_by: userId,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('revenue_reconciliations').update(payload).eq('id', editingId);
        if (error) throw error;
        alert('Cập nhật thành công!');
      } else {
        const { error } = await supabase.from('revenue_reconciliations').insert(payload);
        if (error) throw error;
        alert('Lưu đối chiếu thành công!');
      }
      
      // Reset form
      setEditingId(null);
      setActualCash('');
      setActualTransfer('');
      setNote('');
      setActiveTab('history');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (record: ReconciliationRecord) => {
    setEditingId(record.id);
    setReconDate(record.reconciliation_date);
    setSoftwareRevenue(record.software_revenue);
    setActualCash(record.actual_cash);
    setActualTransfer(record.actual_transfer);
    setNote(record.note || '');
    setActiveTab('form');
  };

  const totalActual = (Number(actualCash) || 0) + (Number(actualTransfer) || 0);
  const currentDiff = totalActual - softwareRevenue;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', flexDirection: 'column' }}>
      <div className="animate-fade-up" style={{ flex: 1, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* HEADER */}
        <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary)' }}>Đối chiếu cuối ngày</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={28} />
          </button>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button 
            style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'form' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'form' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => setActiveTab('form')}
          >
            {editingId ? 'Cập nhật đối chiếu' : 'Thêm đối chiếu'}
          </button>
          <button 
            style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => { setActiveTab('history'); setEditingId(null); }}
          >
            Lịch sử
          </button>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: 'var(--bg-main)' }}>
          
          {/* FORM VIEW */}
          {activeTab === 'form' && (
            <div style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <form onSubmit={handleSave}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Ngày đối chiếu</label>
                  <input 
                    type="date" 
                    value={reconDate} 
                    onChange={e => setReconDate(e.target.value)} 
                    className="form-input" 
                    style={{ width: '100%' }}
                    disabled={!!editingId}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Doanh thu phần mềm (tự tính)</label>
                  <input 
                    type="text" 
                    readOnly 
                    value={softwareRevenue.toLocaleString() + 'đ'} 
                    className="form-input" 
                    style={{ width: '100%', background: 'var(--bg-main)', fontWeight: 'bold', color: 'var(--primary)' }} 
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Tiền mặt thực tế</label>
                  <div 
                    onClick={() => setActiveCalcField('cash')}
                    className="form-input" 
                    style={{ width: '100%', fontWeight: 'bold', cursor: 'pointer', background: 'white', minHeight: '42px', display: 'flex', alignItems: 'center' }} 
                  >
                    {actualCash === '' ? '0' : Number(actualCash).toLocaleString()}
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Chuyển khoản thực tế</label>
                  <div 
                    onClick={() => setActiveCalcField('transfer')}
                    className="form-input" 
                    style={{ width: '100%', fontWeight: 'bold', cursor: 'pointer', background: 'white', minHeight: '42px', display: 'flex', alignItems: 'center' }} 
                  >
                    {actualTransfer === '' ? '0' : Number(actualTransfer).toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '0.75rem', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.1rem' }}>
                    <span style={{ fontWeight: '600' }}>Tổng thực thu:</span>
                    <span style={{ fontWeight: '800' }}>{totalActual.toLocaleString()}đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                    <span style={{ fontWeight: '600' }}>Chênh lệch:</span>
                    <span style={{ 
                      fontWeight: '800', 
                      color: currentDiff === 0 ? 'var(--success)' : currentDiff > 0 ? 'var(--warning)' : 'var(--danger)' 
                    }}>
                      {currentDiff > 0 ? '+' : ''}{currentDiff.toLocaleString()}đ
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Ghi chú</label>
                  <textarea 
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="form-input"
                    rows={3}
                    placeholder="Ghi chú thêm..."
                    style={{ width: '100%', resize: 'vertical' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  {editingId && (
                    <button type="button" className="btn" onClick={() => { setEditingId(null); setActiveTab('history'); }}>Huỷ</button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    {isSaving ? 'Đang lưu...' : 'Lưu đối chiếu'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* HISTORY VIEW */}
          {activeTab === 'history' && (
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Từ ngày</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Đến ngày</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="form-input" />
                </div>
              </div>

              {isLoadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Đang tải...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Không có dữ liệu đối chiếu</div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                  gap: '1.5rem' 
                }}>
                  {history.map(record => {
                    const totalAct = record.actual_cash + record.actual_transfer;
                    return (
                      <div key={record.id} style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{new Date(record.reconciliation_date).toLocaleDateString('vi-VN')}</span>
                          <button onClick={() => handleEdit(record)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Edit size={16} /> Sửa
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>DT phần mềm:</span>
                          <span style={{ fontWeight: '600' }}>{record.software_revenue.toLocaleString()}đ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Tiền mặt:</span>
                          <span>{record.actual_cash.toLocaleString()}đ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Chuyển khoản:</span>
                          <span>{record.actual_transfer.toLocaleString()}đ</span>
                        </div>
                        
                        <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0' }}></div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: '600' }}>Tổng thực thu:</span>
                          <span style={{ fontWeight: 'bold' }}>{totalAct.toLocaleString()}đ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: '600' }}>Chênh lệch:</span>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: record.difference === 0 ? 'var(--success)' : record.difference > 0 ? 'var(--warning)' : 'var(--danger)' 
                          }}>
                            {record.difference > 0 ? '+' : ''}{record.difference.toLocaleString()}đ
                          </span>
                        </div>

                        {record.note && (
                          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <strong>Ghi chú:</strong> {record.note}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {activeCalcField === 'cash' && (
        <Calculator 
          initialValue={Number(actualCash) || 0} 
          onConfirm={(val) => { setActualCash(val); setActiveCalcField(null); }} 
          onClose={() => setActiveCalcField(null)} 
          title="Tính Tiền mặt thực tế" 
        />
      )}
      {activeCalcField === 'transfer' && (
        <Calculator 
          initialValue={Number(actualTransfer) || 0} 
          onConfirm={(val) => { setActualTransfer(val); setActiveCalcField(null); }} 
          onClose={() => setActiveCalcField(null)} 
          title="Tính Chuyển khoản thực tế" 
        />
      )}
    </div>,
    document.body
  );
};

export default ReconciliationModal;
