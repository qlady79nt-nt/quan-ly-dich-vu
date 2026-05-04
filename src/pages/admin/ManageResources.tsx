import { useState } from 'react';
import { BedDouble, Plus, Trash2 } from 'lucide-react';

const ManageResources = () => {
  const [beds] = useState([
    { id: 1, name: 'Giường 1', status: 'available' },
    { id: 2, name: 'Giường 2', status: 'available' },
    { id: 3, name: 'Phòng VIP 1', status: 'available' },
  ]);

  return (
    <div className="premium-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BedDouble size={24} />
          Quản lý Tài nguyên (Giường/Ghế)
        </h2>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} />
          Thêm giường mới
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {beds.map(bed => (
          <div key={bed.id} style={{ 
            border: '1px solid var(--border-color)', 
            borderRadius: '0.5rem', 
            padding: '1.5rem', 
            width: '200px',
            textAlign: 'center',
            position: 'relative'
          }}>
            <button style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', color: 'var(--danger-color)' }}>
              <Trash2 size={16} />
            </button>
            <BedDouble size={40} color="var(--primary-light)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{bed.name}</h3>
            <span className="badge badge-success">Sẵn sàng (Available)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageResources;
