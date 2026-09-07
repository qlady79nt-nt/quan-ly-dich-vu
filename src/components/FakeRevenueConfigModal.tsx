import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Sparkles, AlertCircle, Calendar, Percent } from 'lucide-react';
import { getShopFakeRevenueConfig, saveShopFakeRevenueConfig } from '../lib/fakeRevenueService';

interface FakeRevenueConfigModalProps {
  shopId: string;
  shopName: string;
  onClose: () => void;
}

const FakeRevenueConfigModal = ({ shopId, shopName, onClose }: FakeRevenueConfigModalProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fakeStartDate, setFakeStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [variationPercent, setVariationPercent] = useState(10);
  
  // 31 ngày BASE (1 -> 31)
  const [baseConfig, setBaseConfig] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (let i = 1; i <= 31; i++) {
      init[String(i)] = 5000000;
    }
    return init;
  });

  const [bulkValue, setBulkValue] = useState('5000000');

  useEffect(() => {
    loadConfig();
  }, [shopId]);

  const loadConfig = async () => {
    setLoading(true);
    const config = await getShopFakeRevenueConfig(shopId);
    if (config) {
      if (config.fake_start_date) setFakeStartDate(config.fake_start_date);
      if (config.variation_percent) setVariationPercent(config.variation_percent);
      if (config.base_config && Object.keys(config.base_config).length > 0) {
        setBaseConfig(prev => ({ ...prev, ...config.base_config }));
      }
    }
    setLoading(false);
  };

  const handleDayChange = (day: number, value: string) => {
    const num = parseInt(value.replace(/\D/g, ''), 10) || 0;
    setBaseConfig(prev => ({ ...prev, [String(day)]: num }));
  };

  const handleBulkApply = () => {
    const num = parseInt(bulkValue.replace(/\D/g, ''), 10) || 0;
    if (num <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ!');
      return;
    }
    const updated: Record<string, number> = {};
    for (let i = 1; i <= 31; i++) {
      updated[String(i)] = num;
    }
    setBaseConfig(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await saveShopFakeRevenueConfig(shopId, fakeStartDate, baseConfig, variationPercent);
    setSaving(false);
    if (res.success) {
      alert('Lưu cấu hình doanh số ảo thành công!');
      onClose();
    } else {
      alert('Lỗi lưu cấu hình: ' + (res.error || ''));
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '1rem'
    }}>
      <div className="modal-content animate-fade-up" style={{
        maxWidth: '750px',
        width: '100%',
        maxHeight: '90vh',
        background: 'var(--bg-main, #fff)',
        borderRadius: '1rem',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)' }}>
              Cấu hình Doanh số Ảo 31 Ngày
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Áp dụng cho cửa hàng: <strong>{shopName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="btn" style={{ padding: '0.4rem', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Đang tải cấu hình...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Lưu ý nghiệp vụ */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '0.75rem',
                padding: '1rem',
                fontSize: '0.85rem',
                color: 'var(--text-main)',
                display: 'flex',
                gap: '0.75rem'
              }}>
                <AlertCircle size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Quy tắc hệ thống:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, listStyle: 'disc' }}>
                    <li><strong>Hôm nay:</strong> Nhân viên luôn xem doanh số THẬT từ hóa đơn.</li>
                    <li><strong>Ngày quá khứ:</strong> Tự động sinh dựa trên BASE, dao động có kiểm soát và <strong>KHÓA CỐ ĐỊNH</strong> vĩnh viễn trong Database.</li>
                    <li><strong>Ngày tương lai hoặc trước ngày bắt đầu:</strong> Doanh số = 0.</li>
                    <li><strong>Làm tròn:</strong> Doanh số cuối cùng luôn là bội số của 10.000 VNĐ.</li>
                  </ul>
                </div>
              </div>

              {/* Thông số chung */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                    <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Ngày bắt đầu sinh fake:
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={fakeStartDate}
                    onChange={e => setFakeStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Các ngày trước ngày này sẽ có doanh số = 0
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                    <Percent size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Biên độ dao động (±%):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    className="form-input"
                    value={variationPercent}
                    onChange={e => setVariationPercent(parseInt(e.target.value, 10) || 10)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Mặc định ±10% quanh mức BASE
                  </span>
                </div>
              </div>

              {/* Công cụ gán nhanh */}
              <div style={{
                background: 'var(--bg-secondary, #f8fafc)',
                padding: '1rem',
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  <Sparkles size={16} style={{ display: 'inline', marginRight: '4px', color: 'var(--primary)' }} />
                  Gán nhanh 31 ngày:
                </span>
                <input
                  type="text"
                  className="form-input"
                  value={Number(bulkValue).toLocaleString('vi-VN')}
                  onChange={e => setBulkValue(e.target.value.replace(/\D/g, ''))}
                  style={{ width: '160px', padding: '0.4rem 0.75rem' }}
                />
                <button
                  type="button"
                  onClick={handleBulkApply}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                >
                  Áp dụng cho tất cả
                </button>
              </div>

              {/* Bảng 31 ngày */}
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: '700' }}>
                  Mức BASE từng ngày trong tháng (Ngày 01 đến 31):
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem'
                }}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <div
                      key={day}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: '1px solid var(--border)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '0.5rem',
                        background: 'var(--bg-main)'
                      }}
                    >
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        width: '58px'
                      }}>
                        Ngày {String(day).padStart(2, '0')}:
                      </span>
                      <input
                        type="text"
                        className="form-input"
                        value={Number(baseConfig[String(day)] || 0).toLocaleString('vi-VN')}
                        onChange={e => handleDayChange(day, e.target.value)}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '0.3rem 0.5rem',
                          fontWeight: '600',
                          fontSize: '0.85rem'
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>đ</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          background: 'var(--bg-secondary, #f8fafc)'
        }}>
          <button type="button" onClick={onClose} className="btn" disabled={saving}>
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={16} />
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FakeRevenueConfigModal;
