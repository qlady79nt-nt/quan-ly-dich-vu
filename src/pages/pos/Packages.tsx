import { useState } from 'react';
import { Package, UserCheck, PlayCircle } from 'lucide-react';

const POSPackages = () => {
  const [activeTab, setActiveTab] = useState<'sell' | 'use'>('sell');

  return (
    <div className="premium-card">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('sell')}
          style={{ fontWeight: 'bold', fontSize: '1.1rem', color: activeTab === 'sell' ? 'var(--primary-color)' : 'var(--text-light)', borderBottom: activeTab === 'sell' ? '2px solid var(--primary-color)' : 'none', background: 'none', padding: '0.5rem 1rem' }}
        >
          1. Bán Liệu Trình Mới
        </button>
        <button 
          onClick={() => setActiveTab('use')}
          style={{ fontWeight: 'bold', fontSize: '1.1rem', color: activeTab === 'use' ? 'var(--primary-color)' : 'var(--text-light)', borderBottom: activeTab === 'use' ? '2px solid var(--primary-color)' : 'none', background: 'none', padding: '0.5rem 1rem' }}
        >
          2. Khách Sử Dụng Liệu Trình
        </button>
      </div>

      {activeTab === 'sell' && (
        <div className="grid-cols-2">
          <div>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>Bán Liệu Trình (Tạo Doanh Số, Chưa Tính Doanh Thu)</h3>
            <div className="form-group">
              <label className="form-label">Chọn Khách Hàng</label>
              <input type="text" className="form-input" placeholder="Tìm số điện thoại khách..." />
            </div>
            <div className="form-group">
              <label className="form-label">Chọn Liệu Trình</label>
              <select className="form-select">
                <option>Liệu trình Trị mụn chuyên sâu (10 buổi) - 5.000.000đ</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nhân Viên Bán (Tính Hoa Hồng)</label>
              <select className="form-select">
                <option>Nguyễn Văn A (Lễ tân)</option>
              </select>
            </div>
          </div>
          <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '1rem' }}>Thông tin thanh toán</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Tổng tiền:</span>
              <strong>5.000.000đ</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-light)' }}>
              <span>Doanh thu tính ngay:</span>
              <span>0đ (Chỉ tính khi làm dịch vụ)</span>
            </div>
            <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Package size={20} />
              Tạo Hoá Đơn Bán Liệu Trình
            </button>
          </div>
        </div>
      )}

      {activeTab === 'use' && (
        <div className="grid-cols-2">
          <div>
            <h3 style={{ marginBottom: '1rem', color: 'var(--secondary-color)' }}>Sử Dụng Liệu Trình (Tính Doanh Thu & Hoa Hồng Dịch Vụ)</h3>
            <div className="form-group">
              <label className="form-label">Tìm Khách Hàng</label>
              <input type="text" className="form-input" placeholder="Nhập tên hoặc SĐT..." />
            </div>
            <div style={{ padding: '1rem', border: '1px solid var(--secondary-color)', borderRadius: '0.5rem', marginBottom: '1rem', backgroundColor: 'rgba(0, 191, 165, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <UserCheck color="var(--secondary-color)" />
                <strong>Khách hàng: Chị Lan</strong>
              </div>
              <div>Gói đang có: Trị mụn chuyên sâu</div>
              <div style={{ fontWeight: 'bold', color: 'var(--danger-color)' }}>Số buổi còn lại: 8/10</div>
            </div>
          </div>
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Phân bổ buổi làm</h4>
            <div className="form-group">
              <label className="form-label">Chọn Nhân Viên Làm (Tính hoa hồng tour)</label>
              <select className="form-select">
                <option>Trần Thị B</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Chọn Chỗ (Vị trí dịch vụ)</label>
              <select className="form-select">
                <option>Chỗ 2</option>
              </select>
            </div>
            <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--secondary-color)' }}>
              <PlayCircle size={20} />
              Bắt Đầu Trừ Buổi (Ghi Nhận Doanh Thu)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPackages;
