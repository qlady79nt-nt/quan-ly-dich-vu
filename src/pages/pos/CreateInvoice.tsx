import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search, ShoppingCart, PlayCircle } from 'lucide-react';

const POSCreateInvoice = () => {
  const navigate = useNavigate();
  const [selectedServices] = useState([
    { id: 1, name: 'Massage body 60 phút', price: 500000, duration: 60, staff: '', bed: '' }
  ]);

  const handleStartService = () => {
    // In a real app, we would save to Supabase, update Bed status, etc.
    alert('Đã bắt đầu dịch vụ! Chỗ đã chuyển trạng thái Occupied.');
    navigate('/pos/monitor');
  };

  return (
    <div className="grid-cols-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>1. Chọn Khách Hàng</h2>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={20} color="var(--text-light)" style={{ position: 'absolute', top: '0.8rem', left: '1rem' }} />
            <input type="text" className="form-input" placeholder="Tìm tên hoặc SĐT khách..." style={{ paddingLeft: '3rem' }} />
          </div>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} />
            Tạo khách mới
          </button>
        </div>

        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>2. Chọn Dịch vụ / Liệu trình</h2>
        <div className="grid-cols-3" style={{ marginBottom: '2rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s' }} className="hover:border-primary">
              <h4 style={{ marginBottom: '0.5rem' }}>Dịch vụ Demo {i}</h4>
              <div style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>500,000đ</div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>60 phút</div>
            </div>
          ))}
        </div>

        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>3. Phân bổ Dịch vụ</h2>
        {selectedServices.map((svc, index) => (
          <div key={index} style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1.1rem' }}>{svc.name}</h4>
              <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{svc.price.toLocaleString()}đ</span>
            </div>
            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Chọn Nhân viên (Bắt buộc)</label>
                <select className="form-select">
                  <option value="">-- Chọn nhân viên --</option>
                  <option value="nv1">Nguyễn Văn A</option>
                  <option value="nv2">Trần Thị B</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Chọn Chỗ (Bắt buộc)</label>
                <select className="form-select">
                  <option value="">-- Chọn chỗ --</option>
                  <option value="g1">Chỗ 1 (Trống)</option>
                  <option value="g2">Chỗ 2 (Trống)</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="premium-card" style={{ alignSelf: 'start', position: 'sticky', top: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShoppingCart size={24} />
          Thông tin Hoá Đơn
        </h2>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed var(--border-color)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Khách hàng:</span>
          <strong>Khách lẻ</strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Tạm tính:</span>
          <span>500,000đ</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Giảm giá:</span>
          <span>0đ</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Tổng cộng:</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>500,000đ</span>
        </div>

        <button onClick={handleStartService} className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <PlayCircle size={24} />
          BẮT ĐẦU DỊCH VỤ NGAY
        </button>
      </div>
    </div>
  );
};

export default POSCreateInvoice;
