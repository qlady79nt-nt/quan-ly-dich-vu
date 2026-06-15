import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
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

interface ShopExpense {
  id: string;
  expense_date: string;
  expense_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  is_recurring: boolean;
}

interface Props {
  shopId: string;
  userId: string;
  onClose: () => void;
}

const ReconciliationModal: React.FC<Props> = ({ shopId, userId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'form' | 'history' | 'expenses' | 'expenses_history'>('form');
  
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

  // Expenses State
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expenseName, setExpenseName] = useState('');
  const [expenseQty, setExpenseQty] = useState<number | ''>(1);
  const [expensePrice, setExpensePrice] = useState<number | ''>('');
  const [expenseIsRecurring, setExpenseIsRecurring] = useState(false);
  const [expensesList, setExpensesList] = useState<ShopExpense[]>([]);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'form') {
      fetchSoftwareRevenue(reconDate);
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'expenses') {
      fetchExpenses();
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

  const fetchExpenses = async () => {
    setIsLoadingExpenses(true);
    try {
      const { data, error } = await supabase
        .from('shop_expenses')
        .select('*')
        .eq('shop_id', shopId)
        .gte('expense_date', fromDate)
        .lte('expense_date', toDate)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      setExpensesList(data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách chi phí:', err);
    } finally {
      setIsLoadingExpenses(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCash === '' && actualTransfer === '') {
      alert('Vui lòng nhập ít nhất tiền mặt hoặc chuyển khoản!');
      return;
    }

    setIsSaving(true);
    const cashVal = Number(actualCash) || 0;
    const transferVal = Number(actualTransfer) || 0;
    const totalActual = cashVal + transferVal;
    const difference = totalActual - softwareRevenue;

    const payload = {
      shop_id: shopId,
      reconciliation_date: reconDate,
      software_revenue: softwareRevenue,
      actual_cash: cashVal,
      actual_transfer: transferVal,
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

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName.trim() || expenseQty === '' || expensePrice === '') {
      alert('Vui lòng nhập đủ tên, số lượng và đơn giá!');
      return;
    }
    
    setIsSavingExpense(true);
    const qty = Number(expenseQty);
    const price = Number(expensePrice);
    const total = qty * price;
    
    const payload = {
      shop_id: shopId,
      expense_date: expenseDate,
      expense_name: expenseName,
      quantity: qty,
      unit_price: price,
      total_amount: total,
      is_recurring: expenseIsRecurring,
      created_by: userId
    };
    
    try {
      if (editingExpenseId) {
        const { error } = await supabase.from('shop_expenses').update(payload).eq('id', editingExpenseId);
        if (error) throw error;
        alert('Cập nhật chi phí thành công!');
      } else {
        const { error } = await supabase.from('shop_expenses').insert(payload);
        if (error) throw error;
        alert('Thêm khoản chi thành công!');
      }
      
      setExpenseName('');
      setExpenseQty(1);
      setExpensePrice('');
      setExpenseIsRecurring(false);
      setEditingExpenseId(null);
      fetchExpenses();
    } catch (err: any) {
      alert('Lỗi lưu chi phí: ' + err.message);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá khoản chi này?')) return;
    try {
      const { error } = await supabase.from('shop_expenses').delete().eq('id', id);
      if (error) throw error;
      fetchExpenses();
    } catch (err: any) {
      alert('Lỗi xoá chi phí: ' + err.message);
    }
  };

  const handleEditExpense = (exp: ShopExpense) => {
    setEditingExpenseId(exp.id);
    setExpenseDate(exp.expense_date);
    setExpenseName(exp.expense_name);
    setExpenseQty(exp.quantity);
    setExpensePrice(exp.unit_price);
    setExpenseIsRecurring(exp.is_recurring || false);
  };

  const syncRecurringExpenses = async () => {
    setIsLoadingExpenses(true);
    try {
      const currentMonthStart = new Date(fromDate);
      currentMonthStart.setDate(1);
      
      const prevMonthStart = new Date(currentMonthStart);
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
      const prevMonthEnd = new Date(currentMonthStart);
      prevMonthEnd.setDate(0);
      
      const prevStartStr = prevMonthStart.toISOString().split('T')[0];
      const prevEndStr = prevMonthEnd.toISOString().split('T')[0];

      const { data: prevRecurrings, error: err1 } = await supabase
        .from('shop_expenses')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_recurring', true)
        .gte('expense_date', prevStartStr)
        .lte('expense_date', prevEndStr);
        
      if (err1) throw err1;
      
      if (!prevRecurrings || prevRecurrings.length === 0) {
        alert('Không tìm thấy khoản chi cố định nào trong tháng trước!');
        return;
      }

      const currentNames = expensesList.map(e => e.expense_name.toLowerCase());
      
      const toInsert = prevRecurrings.filter(p => !currentNames.includes(p.expense_name.toLowerCase())).map(p => ({
        shop_id: shopId,
        expense_date: fromDate,
        expense_name: p.expense_name,
        quantity: p.quantity,
        unit_price: p.unit_price,
        total_amount: p.total_amount,
        is_recurring: true,
        created_by: userId
      }));

      if (toInsert.length === 0) {
        alert('Tất cả các khoản chi cố định từ tháng trước đã có mặt trong tháng này rồi!');
        return;
      }

      const { error: err2 } = await supabase.from('shop_expenses').insert(toInsert);
      if (err2) throw err2;
      
      alert(`Đã tự động đồng bộ ${toInsert.length} khoản chi cố định từ tháng trước!`);
      fetchExpenses();
    } catch (err: any) {
      alert('Lỗi đồng bộ: ' + err.message);
    } finally {
      setIsLoadingExpenses(false);
    }
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
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto', alignItems: 'center' }}>
          <button 
            style={{ flex: 1, minWidth: '150px', padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'form' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'form' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => setActiveTab('form')}
          >
            {editingId ? 'Cập nhật đối chiếu' : 'Thêm đối chiếu'}
          </button>
          <button 
            style={{ flex: 1, minWidth: '150px', padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => { setActiveTab('history'); setEditingId(null); }}
          >
            Lịch sử đối chiếu
          </button>
          
          <div style={{ width: '4px', height: '2rem', background: 'var(--text-secondary)', margin: '0 0.5rem', borderRadius: '2px', opacity: 0.5 }}></div>

          <button 
            style={{ flex: 1, minWidth: '150px', padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'expenses' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'expenses' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => setActiveTab('expenses')}
          >
            Nhập chi hàng hoá
          </button>
          <button 
            style={{ flex: 1, minWidth: '150px', padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'expenses_history' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'expenses_history' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => { setActiveTab('expenses_history'); setEditingExpenseId(null); }}
          >
            Lịch sử chi
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
                <>
                  <div className="desktop-only" style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                          <th style={{ padding: '1rem', fontWeight: 'bold' }}>Ngày</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>DT phần mềm</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>Tiền mặt</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>Chuyển khoản</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>Tổng thực thu</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>Chênh lệch</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold' }}>Ghi chú</th>
                          <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((record, index) => {
                          const totalAct = record.actual_cash + record.actual_transfer;
                          return (
                            <tr key={record.id} style={{ borderBottom: index === history.length - 1 ? 'none' : '1px solid var(--border)' }}>
                              <td style={{ padding: '1rem', fontWeight: 'bold' }}>{new Date(record.reconciliation_date).toLocaleDateString('vi-VN')}</td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>{record.software_revenue.toLocaleString()}đ</td>
                              <td style={{ padding: '1rem', textAlign: 'right' }}>{record.actual_cash.toLocaleString()}đ</td>
                              <td style={{ padding: '1rem', textAlign: 'right' }}>{record.actual_transfer.toLocaleString()}đ</td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>{totalAct.toLocaleString()}đ</td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: record.difference === 0 ? 'var(--success)' : record.difference > 0 ? 'var(--warning)' : 'var(--danger)' }}>
                                {record.difference > 0 ? '+' : ''}{record.difference.toLocaleString()}đ
                              </td>
                              <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>{record.note || '-'}</td>
                              <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <button onClick={() => handleEdit(record)} className="btn" style={{ background: 'transparent', color: 'var(--primary)', padding: '0.25rem 0.5rem', border: '1px solid var(--primary)', fontSize: '0.875rem' }}>Sửa</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {history.map(record => {
                      const totalAct = record.actual_cash + record.actual_transfer;
                      return (
                        <div key={record.id} style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem', boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.05)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{new Date(record.reconciliation_date).toLocaleDateString('vi-VN')}</span>
                            <button onClick={() => handleEdit(record)} className="btn" style={{ background: 'transparent', color: 'var(--primary)', padding: '0.25rem 0.5rem', border: '1px solid var(--primary)', fontSize: '0.875rem' }}>Sửa</button>
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
                          
                          <div style={{ borderTop: '1px dashed var(--border)', margin: '0.75rem 0' }}></div>
                          
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
                </>
              )}
            </div>
          )}

          {/* EXPENSES VIEW */}
          {activeTab === 'expenses' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: 'var(--primary)' }}>
                  {editingExpenseId ? 'Cập nhật khoản chi' : 'Nhập khoản chi mới'}
                </h3>
                <form onSubmit={handleSaveExpense}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Ngày chi</label>
                    <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="form-input" style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Tên khoản chi (hàng hóa, dịch vụ...)</label>
                    <input type="text" value={expenseName} onChange={e => setExpenseName(e.target.value)} placeholder="Ví dụ: Tiền điện, Nhập sữa rửa mặt..." className="form-input" style={{ width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Số lượng</label>
                      <input type="number" min="1" step="0.1" value={expenseQty} onChange={e => setExpenseQty(e.target.value === '' ? '' : Number(e.target.value))} className="form-input" style={{ width: '100%' }} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Đơn giá (đ)</label>
                      <input type="number" min="0" value={expensePrice} onChange={e => setExpensePrice(e.target.value === '' ? '' : Number(e.target.value))} className="form-input" style={{ width: '100%' }} />
                    </div>
                  </div>
                  
                  <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600' }}>Tổng cộng:</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                      {((Number(expenseQty) || 0) * (Number(expensePrice) || 0)).toLocaleString()}đ
                    </span>
                  </div>

                  <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      id="isRecurring"
                      checked={expenseIsRecurring}
                      onChange={e => setExpenseIsRecurring(e.target.checked)}
                      style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                    />
                    <label htmlFor="isRecurring" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>
                      Đây là khoản chi cố định hàng tháng (Mặt bằng, Internet...)
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    {editingExpenseId && (
                      <button type="button" className="btn" onClick={() => {
                        setEditingExpenseId(null);
                        setExpenseName('');
                        setExpenseQty(1);
                        setExpensePrice('');
                        setExpenseIsRecurring(false);
                      }}>Huỷ</button>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={isSavingExpense}>
                      {isSavingExpense ? 'Đang lưu...' : 'Lưu khoản chi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EXPENSES HISTORY VIEW */}
          {activeTab === 'expenses_history' && (
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Từ ngày</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="form-input" style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Đến ngày</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="form-input" style={{ width: '100%' }} />
                </div>
                <div>
                  <button 
                    onClick={syncRecurringExpenses} 
                    className="btn" 
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', fontWeight: 'bold' }}
                  >
                    Đồng bộ chi phí cố định tháng trước
                  </button>
                </div>
              </div>

              {isLoadingExpenses ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Đang tải danh sách...</div>
              ) : expensesList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  Chưa có dữ liệu chi tiêu trong khoảng thời gian này
                </div>
              ) : (
                <>
                  <div className="desktop-only" style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                          <th style={{ padding: '1rem', fontWeight: 'bold' }}>Ngày chi</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold' }}>Tên khoản chi</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>SL × Đơn giá</th>
                          <th style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>Tổng cộng</th>
                          <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expensesList.map((exp, index) => (
                          <tr key={exp.id} style={{ borderBottom: index === expensesList.length - 1 ? 'none' : '1px solid var(--border)' }}>
                            <td style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                                <span style={{ fontWeight: '500' }}>{new Date(exp.expense_date).toLocaleDateString('vi-VN')}</span>
                                {exp.is_recurring && <span style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem' }}>Cố định</span>}
                              </div>
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 'bold' }}>{exp.expense_name}</td>
                            <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{exp.quantity} × {exp.unit_price.toLocaleString()}đ</td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--danger)' }}>- {exp.total_amount.toLocaleString()}đ</td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button onClick={() => handleEditExpense(exp)} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}>Sửa</button>
                                <button onClick={() => handleDeleteExpense(exp.id)} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>Xoá</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {expensesList.map(exp => (
                      <div key={exp.id} style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            {new Date(exp.expense_date).toLocaleDateString('vi-VN')} 
                            {exp.is_recurring && <span style={{ marginLeft: '0.5rem', color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem' }}>Cố định</span>}
                          </div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{exp.expense_name}</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            SL: {exp.quantity} × {exp.unit_price.toLocaleString()}đ
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--danger)' }}>
                            - {exp.total_amount.toLocaleString()}đ
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => handleEditExpense(exp)} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}>Sửa</button>
                            <button onClick={() => handleDeleteExpense(exp.id)} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>Xoá</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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
