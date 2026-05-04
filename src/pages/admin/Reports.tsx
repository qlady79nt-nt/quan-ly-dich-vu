import { DollarSign, Users, Target } from 'lucide-react';

const Reports = () => {
  return (
    <div className="grid-cols-2">
      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DollarSign size={24} />
          Báo Cáo Doanh Thu Thực Tế
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Doanh thu = Dịch vụ lẻ hoàn thành + Buổi liệu trình đã sử dụng. KHÔNG tính tiền bán liệu trình chưa dùng.
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>Tổng Doanh Thu Trong Ngày</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success-color)' }}>12,500,000đ</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--danger-color)' }}>Trừ Tiền Vật Liệu Tiêu Hao</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>- 1,200,000đ</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Lợi Nhuận Gộp</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>11,300,000đ</span>
        </div>
      </div>

      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={24} />
          Báo Cáo Nhân Viên & Hoa Hồng
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '0.5rem' }}>Nhân viên</th>
              <th style={{ padding: '0.5rem' }}>HH Làm Dịch vụ</th>
              <th style={{ padding: '0.5rem' }}>HH Bán Liệu Trình</th>
              <th style={{ padding: '0.5rem' }}>Tổng</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 0.5rem' }}>Nguyễn Văn A</td>
              <td style={{ padding: '0.75rem 0.5rem' }}>350,000đ</td>
              <td style={{ padding: '0.75rem 0.5rem' }}>1,500,000đ</td>
              <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>1,850,000đ</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 0.5rem' }}>Trần Thị B</td>
              <td style={{ padding: '0.75rem 0.5rem' }}>800,000đ</td>
              <td style={{ padding: '0.75rem 0.5rem' }}>0đ</td>
              <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>800,000đ</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="premium-card" style={{ gridColumn: 'span 2' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={24} />
          Báo Cáo Giường (Hiệu Suất)
        </h2>
        <div className="grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Giường {i}</h4>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>85%</div>
              <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Tỷ lệ sử dụng</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Cao điểm: <strong>14:00 - 16:00</strong></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
