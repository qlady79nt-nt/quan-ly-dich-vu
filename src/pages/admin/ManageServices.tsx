import { Package, Plus, Syringe } from 'lucide-react';

const ManageServices = () => {
  return (
    <div className="grid-cols-2">
      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={24} />
          Tạo Dịch Vụ
        </h2>
        <div className="form-group">
          <label className="form-label">Tên dịch vụ</label>
          <input type="text" className="form-input" placeholder="Massage body 60 phút" />
        </div>
        <div className="grid-cols-2" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Giá dịch vụ (VNĐ)</label>
            <input type="number" className="form-input" placeholder="500000" />
          </div>
          <div className="form-group">
            <label className="form-label">Thời gian (Phút) - RẤT QUAN TRỌNG</label>
            <input type="number" className="form-input" placeholder="60" />
          </div>
        </div>
        <div className="grid-cols-2" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Loại Hoa hồng</label>
            <select className="form-select">
              <option value="percent">% Phần trăm</option>
              <option value="fixed">Tiền mặt</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Mức Hoa hồng</label>
            <input type="number" className="form-input" placeholder="10" />
          </div>
        </div>
        <button className="btn-primary" style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Plus size={20} />
          Lưu Dịch vụ
        </button>
      </div>

      <div className="premium-card">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Syringe size={24} />
          Định mức Nguyên Vật Liệu
        </h2>
        <div className="form-group">
          <label className="form-label">Chọn Dịch vụ</label>
          <select className="form-select">
            <option>Massage body 60 phút</option>
            <option>Chăm sóc da mặt chuyên sâu</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Thêm Vật liệu tiêu hao</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select className="form-select" style={{ flex: 2 }}>
              <option>Tinh dầu Massage (ml)</option>
              <option>Mặt nạ vàng (Cái)</option>
            </select>
            <input type="number" className="form-input" placeholder="SL" style={{ flex: 1 }} />
            <button className="btn-secondary"><Plus size={20} /></button>
          </div>
        </div>

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Tạo Liệu Trình (Packages)</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Nhóm nhiều dịch vụ thành 1 liệu trình, bán với giá ưu đãi.
          </p>
          <button className="btn-secondary" style={{ width: '100%' }}>Thiết lập Liệu Trình</button>
        </div>
      </div>
    </div>
  );
};

export default ManageServices;
