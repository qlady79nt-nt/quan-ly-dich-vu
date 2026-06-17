import React, { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Printer, Search, Settings2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ShopPrintSettings, getPrintSettings, updatePrintSettings, DEFAULT_PRINT_SETTINGS } from '../lib/printSettings';
import { ReceiptTemplate } from '../components/ReceiptTemplate';

export default function PrintSettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<ShopPrintSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // States cho thông số thực tế
  const [realWidth, setRealWidth] = useState(0);
  const [realHeight, setRealHeight] = useState(0);
  
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const shopId = profile?.shop_id || '';

  useEffect(() => {
    if (shopId) {
      loadSettings();
    }
  }, [shopId]);

  // Cập nhật kích thước thực tế mỗi khi settings hoặc debugMode đổi
  useEffect(() => {
    if (receiptRef.current) {
      // Đợi 1 chút để DOM cập nhật xong
      setTimeout(() => {
        if (receiptRef.current) {
          const rect = receiptRef.current.getBoundingClientRect();
          setRealWidth(Math.round(rect.width));
          setRealHeight(Math.round(rect.height));
        }
      }, 50);
    }
  }, [settings, debugMode]);

  const loadSettings = async () => {
    setLoading(true);
    const data = await getPrintSettings(shopId);
    setSettings(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const success = await updatePrintSettings(settings);
    if (success) {
      alert('Đã lưu cấu hình máy in thành công!');
    } else {
      alert('Có lỗi xảy ra khi lưu cấu hình.');
    }
    setSaving(false);
  };

  const handleReset = () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục về cấu hình mặc định?')) {
      setSettings({
        ...DEFAULT_PRINT_SETTINGS,
        shop_id: shopId
      });
    }
  };

  const handleTestPrint = () => {
    window.print();
  };

  if (loading || !settings) {
    return <div className="p-4">Đang tải cấu hình...</div>;
  }

  // Hóa đơn mẫu để preview và in thử
  const mockInvoice = {
    invoice_code: 'TEST-001',
    customer_name: 'Khách test',
    customer_phone: '0901234567',
    staff_name: profile?.full_name || 'Nhân viên',
    created_at: new Date().toISOString(),
    is_use_package: false,
    items: [
      { name: 'Gội đầu VIP', price: 199000 }
    ],
    total_amount: 199000,
    discount_amount: 0,
    final_amount: 199000
  };

  const mockConfig = {
    shop_name: profile?.shop?.name || 'Cửa hàng của bạn',
    address: 'Địa chỉ shop',
    phone: '0123456789'
  };

  return (
    <div className="animate-fade" style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Settings2 size={24} className="text-primary" />
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>CÀI ĐẶT MÁY IN</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        
        {/* Phần cài đặt */}
        <div className="card p-4">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
             Cấu hình thông số
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Khổ giấy */}
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Khổ giấy</label>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="paper_size" 
                    value="58mm" 
                    checked={settings.paper_size === '58mm'}
                    onChange={() => setSettings({ ...settings, paper_size: '58mm' })}
                  />
                  58mm
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="paper_size" 
                    value="80mm" 
                    checked={settings.paper_size === '80mm'}
                    onChange={() => setSettings({ ...settings, paper_size: '80mm' })}
                  />
                  80mm
                </label>
              </div>
            </div>

            {/* Khung debug */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', background: 'var(--bg-main)', borderRadius: '0.5rem' }}>
              <input 
                type="checkbox" 
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
              />
              Hiện khung debug (viền đỏ)
            </label>

            {/* Các offset và scale */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem', display: 'block' }}>Top Offset (px)</label>
                <input 
                  type="number" 
                  className="input" 
                  value={settings.top_offset}
                  onChange={(e) => setSettings({ ...settings, top_offset: parseInt(e.target.value) || 0 })}
                  placeholder="Ví dụ: -10"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem', display: 'block' }}>Left Offset (px)</label>
                <input 
                  type="number" 
                  className="input" 
                  value={settings.left_offset}
                  onChange={(e) => setSettings({ ...settings, left_offset: parseInt(e.target.value) || 0 })}
                  placeholder="Ví dụ: 5"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem', display: 'block' }}>Scale (%)</label>
                <input 
                  type="number" 
                  className="input" 
                  value={settings.scale_percent}
                  onChange={(e) => setSettings({ ...settings, scale_percent: parseInt(e.target.value) || 100 })}
                  placeholder="100"
                />
              </div>
            </div>

            {/* Thông số thực tế */}
            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
              <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Kích thước thực tế trên màn hình:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Chiều rộng: <strong style={{ color: realWidth > 400 ? 'red' : 'inherit' }}>{realWidth}px</strong></span>
                <span>Chiều cao: <strong>{realHeight}px</strong></span>
              </div>
              {realWidth > 400 && <p style={{ color: 'red', marginTop: '0.5rem', fontSize: '0.75rem' }}>Cảnh báo: Khổ giấy quá lớn, CSS có thể đang bị ghi đè!</p>}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                onClick={handleReset} 
                className="btn btn-outline" 
                style={{ flex: 1 }}
              >
                <RefreshCw size={18} />
                Mặc định
              </button>
              <button 
                onClick={handleSave} 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={saving}
              >
                <Save size={18} />
                {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          </div>
        </div>

        {/* Phần Preview */}
        <div className="card p-4" style={{ overflowX: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
               <Search size={20} /> Xem trước
            </h2>
            <button onClick={handleTestPrint} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
              <Printer size={18} /> In thử
            </button>
          </div>

          <div style={{ padding: '1rem', background: '#e5e7eb', borderRadius: '0.5rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
            {/* Sử dụng ReceiptTemplate dạng renderInline để nhúng thẳng vào trang */}
            <ReceiptTemplate 
              invoice={mockInvoice}
              config={mockConfig}
              printSettings={settings}
              debugMode={debugMode}
              renderInline={true}
              containerRef={receiptRef}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
