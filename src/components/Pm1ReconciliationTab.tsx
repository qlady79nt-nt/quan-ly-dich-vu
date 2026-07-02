import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  shopId: string;
}

interface Pm1Record {
  id: string;
  date: string;
  pm1Revenue: number;
  cash: number;
  transfer: number;
  difference: number;
}

const Pm1ReconciliationTab: React.FC<Props> = ({ shopId }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pm1Revenue, setPm1Revenue] = useState<number | ''>('');
  const [cash, setCash] = useState<number | ''>('');
  const [transfer, setTransfer] = useState<number | ''>('');
  const [records, setRecords] = useState<Pm1Record[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(`pm1_recon_${shopId}`);
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, [shopId]);

  const saveRecords = (newRecords: Pm1Record[]) => {
    setRecords(newRecords);
    localStorage.setItem(`pm1_recon_${shopId}`, JSON.stringify(newRecords));
  };

  const currentDiff = (Number(cash) + Number(transfer)) - Number(pm1Revenue);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (pm1Revenue === '' || cash === '' || transfer === '') {
      alert('Vui lòng nhập đầy đủ các số liệu!');
      return;
    }
    
    const newRecord: Pm1Record = {
      id: Date.now().toString(),
      date,
      pm1Revenue: Number(pm1Revenue),
      cash: Number(cash),
      transfer: Number(transfer),
      difference: currentDiff
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
    alert('Đã lưu thành công!');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá đối chiếu này?')) {
      const newRecords = records.filter(r => r.id !== id);
      saveRecords(newRecords);
    }
  };

  return (
    <div style={{ padding: '1rem', background: 'var(--bg-main)', height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Nhập Đối chiếu PM1</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Ngày</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="form-input" 
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Doanh thu PM1</label>
              <input 
                type="number" 
                value={pm1Revenue} 
                onChange={e => setPm1Revenue(e.target.value ? Number(e.target.value) : '')} 
                className="form-input" 
                style={{ width: '100%' }}
                placeholder="Nhập doanh thu phần mềm"
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Tiền mặt</label>
              <input 
                type="number" 
                value={cash} 
                onChange={e => setCash(e.target.value ? Number(e.target.value) : '')} 
                className="form-input" 
                style={{ width: '100%' }}
                placeholder="Nhập số tiền mặt"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Chuyển khoản (CK)</label>
              <input 
                type="number" 
                value={transfer} 
                onChange={e => setTransfer(e.target.value ? Number(e.target.value) : '')} 
                className="form-input" 
                style={{ width: '100%' }}
                placeholder="Nhập số tiền CK"
              />
            </div>
          </div>

          <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '0.75rem', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
              <span style={{ fontWeight: '600' }}>Chênh lệch = (Tiền mặt + CK) - Doanh thu PM1:</span>
              <span style={{ 
                fontWeight: '800', 
                color: currentDiff === 0 ? 'var(--success)' : currentDiff > 0 ? 'var(--warning)' : 'var(--danger)' 
              }}>
                {currentDiff > 0 ? '+' : ''}{currentDiff.toLocaleString()}đ
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">Lưu lại</button>
          </div>
        </form>
      </div>

      {records.length > 0 && (
        <div style={{ maxWidth: '800px', margin: '2rem auto 0', background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Lịch sử đối chiếu PM1</h3>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '1rem' }}>Ngày</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>DT PM1</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Tiền mặt + CK</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Chênh lệch</th>
                  <th style={{ padding: '1rem', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>{new Date(r.date).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>{r.pm1Revenue.toLocaleString()}đ</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>{(r.cash + r.transfer).toLocaleString()}đ</td>
                    <td style={{ 
                      padding: '1rem', textAlign: 'right', fontWeight: '800',
                      color: r.difference === 0 ? 'var(--success)' : r.difference > 0 ? 'var(--warning)' : 'var(--danger)'
                    }}>
                      {r.difference > 0 ? '+' : ''}{r.difference.toLocaleString()}đ
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Xoá">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pm1ReconciliationTab;
