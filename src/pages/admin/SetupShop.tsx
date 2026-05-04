import React from 'react';
import { Save } from 'lucide-react';

const SetupShop = () => {
  return (
    <div className="premium-card">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>1. Khởi tạo Shop & Admin</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Bước này cấu hình thông tin cửa hàng cơ bản và tài khoản Admin có full quyền.
      </p>

      <div className="grid-cols-2">
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Thông tin Cửa hàng</h3>
          <div className="form-group">
            <label className="form-label">Tên Cửa hàng (Shop Name)</label>
            <input type="text" className="form-input" placeholder="Ví dụ: Beauty Spa Cao Cấp" />
          </div>
          <div className="form-group">
            <label className="form-label">Địa chỉ</label>
            <input type="text" className="form-input" placeholder="123 Đường ABC..." />
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Tài khoản Admin</h3>
          <div className="form-group">
            <label className="form-label">Tên hiển thị Admin</label>
            <input type="text" className="form-input" placeholder="Admin User" />
          </div>
          <div className="form-group">
            <label className="form-label">Email đăng nhập</label>
            <input type="email" className="form-input" placeholder="admin@spa.com" />
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={20} />
          Lưu cấu hình hệ thống
        </button>
      </div>
    </div>
  );
};

export default SetupShop;
