import React, { useState, useEffect } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  shopId: string;
}

interface Pm1Record {
  id: string;
  date: string;
  pm1Revenue: number | '';
  cash: number | '';
  transfer: number | '';
  tipCalc: number;
  actualTip: number | '';
  finalDiff: number;
}

const Pm1ReconciliationTab: React.FC<Props> = ({ shopId }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pm1Revenue, setPm1Revenue] = useState<number | ''>('');
  const [cash, setCash] = useState<number | ''>('');
  const [transfer, setTransfer] = useState<number | ''>('');
  const [actualTip, setActualTip] = useState<number | ''>('');
  const [records, setRecords] = useState<Pm1Record[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(`pm1_recon_${shopId}`);
    let loadedRecords: Pm1Record[] = [];
    if (saved) {
      try {
        loadedRecords = JSON.parse(saved);
        setRecords(loadedRecords);
      } catch (e) {
        console.error(e);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let oldestDateStr = todayStr;

    if (loadedRecords.length > 0) {
      const oldestTime = Math.min(...loadedRecords.map(r => new Date(r.date).getTime()));
      oldestDateStr = new Date(oldestTime).toISOString().split('T')[0];
    } else {
      const d = new Date();
      d.setDate(1);
      oldestDateStr = d.toISOString().split('T')[0];
    }

    const start = new Date(oldestDateStr);
    const end = new Date(todayStr);
    let changed = false;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!loadedRecords.find(r => r.date === dateStr)) {
        loadedRecords.push({
          id: `auto-${dateStr}`,
          date: dateStr,
          pm1Revenue: '',
          cash: '',
          transfer: '',
          tipCalc: 0,
          actualTip: '',
          finalDiff: 0
        });
        changed = true;
      }
    }

    if (changed) {
      loadedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecords([...loadedRecords]);
      localStorage.setItem(`pm1_recon_${shopId}`, JSON.stringify(loadedRecords));
    }

    const existingToday = loadedRecords.find(r => r.date === todayStr);
    if (existingToday) {
      setPm1Revenue(existingToday.pm1Revenue);
      setCash(existingToday.cash);
      setTransfer(existingToday.transfer);
      setActualTip(existingToday.actualTip);
    } else {
      fetchDailyTip(todayStr);
    }
  }, [shopId]);

  const fetchDailyTip = async (targetDate: string) => {
    try {
      const [y, m, d] = targetDate.split('-').map(Number);
      const startObj = new Date(y, m - 1, d, 0, 0, 0);
      const endObj = new Date(y, m - 1, d, 23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from('staff_daily_income')
        .select('tip_amount')
        .eq('shop_id', shopId)
        .gte('created_at', startObj.toISOString())
        .lte('created_at', endObj.toISOString());
        
      if (!error && data) {
        const totalTip = data.reduce((sum, item) => sum + (Number(item.tip_amount) || 0), 0);
        setActualTip(totalTip > 0 ? totalTip : '');
      }
    } catch (e) {
      console.error('Error fetching tip:', e);
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const existing = records.find(r => r.date === newDate);
    if (existing) {
      setPm1Revenue(existing.pm1Revenue);
      setCash(existing.cash);
      setTransfer(existing.transfer);
      setActualTip(existing.actualTip);
    } else {
      setPm1Revenue('');
      setCash('');
      setTransfer('');
      setActualTip('');
      fetchDailyTip(newDate);
    }
  };

  const saveRecords = (newRecords: Pm1Record[]) => {
    setRecords(newRecords);
    localStorage.setItem(`pm1_recon_${shopId}`, JSON.stringify(newRecords));
  };

  const tipCalc = (Number(cash) + Number(transfer)) - Number(pm1Revenue);
  const finalDiff = tipCalc - Number(actualTip);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newRecord: Pm1Record = {
      id: Date.now().toString(),
      date,
      pm1Revenue: pm1Revenue === '' ? '' : Number(pm1Revenue),
      cash: cash === '' ? '' : Number(cash),
      transfer: transfer === '' ? '' : Number(transfer),
      tipCalc,
      actualTip: actualTip === '' ? '' : Number(actualTip),
      finalDiff
    };

    const existingIndex = records.findIndex(r => r.date === date);
    let newRecords = [...records];
    if (existingIndex >= 0) {
      if (window.confirm(`Đã có dữ liệu đối chiếu PM1 cho ngày ${new Date(date).toLocaleDateString('vi-VN')}. Bạn có muốn cập nhật lại?`)) {
        newRecords[existingIndex] = newRecord;
      } else {
        return;
      }
    } else {
      newRecords.push(newRecord);
    }
    
    newRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    saveRecords(newRecords);
    
    setPm1Revenue('');
    setCash('');
    setTransfer('');
    setActualTip('');
    alert('Đã lưu thành công!');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá đối chiếu này?')) {
      const newRecords = records.filter(r => r.id !== id);
      saveRecords(newRecords);
    }
  };

  const handleEdit = (record: Pm1Record) => {
    setDate(record.date);
    setPm1Revenue(record.pm1Revenue);
    setCash(record.cash);
    setTransfer(record.transfer);
    
    if (record.actualTip === '') {
      fetchDailyTip(record.date);
    } else {
      setActualTip(record.actualTip);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: '1rem', background: 'var(--bg-main)', height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Nhập Đối chiếu PM1</h3>
        <form onSubmit={handleSave}>
          <div className="table-responsive" style={{ overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', minWidth: '800px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', whiteSpace: 'nowrap' }}>Ngày</label>
                <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} className="form-input" style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ flex: 1.2 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', whiteSpace: 'nowrap' }}>DT PM1</label>
                <input type="number" value={pm1Revenue} onChange={e => setPm1Revenue(e.target.value ? Number(e.target.value) : '')} className="form-input" style={{ width: '100%', padding: '0.5rem' }} placeholder="0" />
              </div>
              <div style={{ flex: 1.2 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', whiteSpace: 'nowrap' }}>Tiền mặt</label>
                <input type="number" value={cash} onChange={e => setCash(e.target.value ? Number(e.target.value) : '')} className="form-input" style={{ width: '100%', padding: '0.5rem' }} placeholder="0" />
              </div>
              <div style={{ flex: 1.2 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', whiteSpace: 'nowrap' }}>CK</label>
                <input type="number" value={transfer} onChange={e => setTransfer(e.target.value ? Number(e.target.value) : '')} className="form-input" style={{ width: '100%', padding: '0.5rem' }} placeholder="0" />
              </div>
              <div style={{ flex: 1.2 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', whiteSpace: 'nowrap' }}>Tip thực tế</label>
                <input type="number" value={actualTip} onChange={e => setActualTip(e.target.value ? Number(e.target.value) : '')} className="form-input" style={{ width: '100%', padding: '0.5rem' }} placeholder="Tự động tính..." />
              </div>
              <div>
                <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '0.5rem 1.5rem', height: '42px' }}>Lưu lại</button>
              </div>
            </div>
          </div>

          <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-main)', borderRadius: '0.75rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>Tip tính toán (Tiền mặt + CK - DT PM1):</span>
              <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                {tipCalc > 0 ? '+' : ''}{tipCalc.toLocaleString()}đ
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
              <span style={{ fontWeight: '600' }}>Chênh lệch = Tip - Tip thực tế:</span>
              <span style={{ 
                fontWeight: '800', 
                color: finalDiff === 0 ? 'var(--success)' : finalDiff > 0 ? 'var(--warning)' : 'var(--danger)' 
              }}>
                {finalDiff > 0 ? '+' : ''}{finalDiff.toLocaleString()}đ
              </span>
            </div>
          </div>
        </form>
      </div>

      {records.length > 0 && (
        <div style={{ maxWidth: '1000px', margin: '2rem auto 0' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Lịch sử đối chiếu PM1</h3>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '1rem' }}>Ngày</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>DT PM1</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Tiền mặt + CK</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)' }}>Tip</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--warning)' }}>Tip thực tế</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Chênh lệch</th>
                  <th style={{ padding: '1rem', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const isComplete = r.pm1Revenue !== '' && r.cash !== '' && r.transfer !== '' && r.actualTip !== '';
                  const rowBg = isComplete ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)';
                  
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: rowBg }}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>
                        {new Date(r.date).toLocaleDateString('vi-VN')}
                        {!isComplete && <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 'normal', marginTop: '0.25rem' }}>Chưa đầy đủ</div>}
                        {isComplete && <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 'normal', marginTop: '0.25rem' }}>Đã đầy đủ</div>}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>{r.pm1Revenue === '' ? '-' : Number(r.pm1Revenue).toLocaleString() + 'đ'}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>{(r.cash === '' && r.transfer === '') ? '-' : (Number(r.cash) + Number(r.transfer)).toLocaleString() + 'đ'}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>
                        {r.tipCalc > 0 ? '+' : ''}{r.tipCalc.toLocaleString()}đ
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--warning)' }}>
                        {r.actualTip === '' ? '-' : Number(r.actualTip).toLocaleString() + 'đ'}
                      </td>
                      <td style={{ 
                        padding: '1rem', textAlign: 'right', fontWeight: '800',
                        color: r.finalDiff === 0 ? 'var(--success)' : r.finalDiff > 0 ? 'var(--warning)' : 'var(--danger)'
                      }}>
                        {r.finalDiff > 0 ? '+' : ''}{r.finalDiff.toLocaleString()}đ
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleEdit(r)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '0.75rem' }} title="Chỉnh sửa">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Xoá">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pm1ReconciliationTab;
