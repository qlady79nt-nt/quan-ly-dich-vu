import { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Printer, Search, Settings2, Bug, SlidersHorizontal, FileText } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getPrintSettings, updatePrintSettings, DEFAULT_PRINT_SETTINGS } from '../lib/printSettings';
import type { ShopPrintSettings } from '../lib/printSettings';
import { ReceiptTemplate } from '../components/ReceiptTemplate';

export default function PrintSettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<ShopPrintSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // Tabs: 'preview' | 'debug' | 'tweak' | 'test'
  const [activeTab, setActiveTab] = useState<'preview' | 'debug' | 'tweak' | 'test'>('preview');
  
  // States cho thông số thực tế
  const [realWidth, setRealWidth] = useState(0);
  const [realHeight, setRealHeight] = useState(0);
  const [topGap, setTopGap] = useState(0);
  
  const receiptRef = useRef<HTMLDivElement>(null);
  const testReceiptRef = useRef<HTMLDivElement>(null);
  
  const shopId = profile?.shop_id || '';

  useEffect(() => {
    if (shopId) {
      loadSettings();
    }
  }, [shopId]);

  // Cập nhật kích thước thực tế mỗi khi settings, debugMode, hoặc tab đổi
  useEffect(() => {
    const measure = () => {
      const ref = activeTab === 'test' ? testReceiptRef.current : receiptRef.current;
      if (ref) {
        const rect = ref.getBoundingClientRect();
        setRealWidth(Math.round(rect.width));
        setRealHeight(Math.round(rect.height));
        setTopGap(Math.round(rect.top));
      }
    };

    setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [settings, debugMode, activeTab]);

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

  const handleTestPrint = (size: '58mm' | '80mm') => {
    // Tạm thời set khổ giấy in test
    const oldSize = settings?.paper_size;
    if (settings) {
      setSettings({ ...settings, paper_size: size });
    }
    
    setTimeout(() => {
      window.print();
      // Khôi phục lại
      if (settings && oldSize) {
        setTimeout(() => setSettings({ ...settings, paper_size: oldSize }), 100);
      }
    }, 100);
  };

  if (loading || !settings) {
    return <div className="p-4">Đang tải cấu hình...</div>;
  }

  // Hóa đơn mẫu
  const mockInvoice = {
    invoice_code: 'TEST-001',
    customer_name: 'Khách test',
    customer_phone: '0901234567',
    staff_name: profile?.full_name || 'Nhân viên',
    created_at: new Date().toISOString(),
    is_use_package: false,
    items: [
      { name: 'Dịch vụ Test 1', price: 100000 },
      { name: 'Dịch vụ Test 2', price: 99000 }
    ],
    total_amount: 199000,
    discount_amount: 0,
    final_amount: 199000
  };

  const mockConfig = {
    shop_name: profile?.shop?.name || 'SPA & POS',
    address: '123 Đường Test, Quận 1',
    phone: '0123456789'
  };

  const tabClass = (tabId: string) => 
    `flex-1 py-3 px-4 text-center font-medium border-b-2 cursor-pointer transition-colors ${activeTab === tabId ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`;

  // Kích thước container test
  const testPaperWidth = settings.paper_size === '58mm' ? '220px' : '300px';
  const testStyles: any = {
    width: testPaperWidth,
    margin: '0 auto',
    background: 'white',
    padding: '10px',
    fontFamily: 'monospace',
    color: '#000',
    position: 'relative'
  };

  if (settings) {
    testStyles.top = `${settings.top_offset || 0}px`;
    testStyles.left = `${settings.left_offset || 0}px`;
    if (settings.scale_percent && settings.scale_percent !== 100) {
      testStyles.transform = `scale(${settings.scale_percent / 100})`;
      testStyles.transformOrigin = 'top left';
    }
  }

  if (debugMode) {
    testStyles.border = '2px dashed red';
  }

  return (
    <div className="animate-fade" style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Settings2 size={24} className="text-primary" />
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>CÀI ĐẶT MÁY IN</h1>
      </div>

      <div className="card overflow-hidden">
        {/* Tab Header */}
        <div className="flex border-b" style={{ overflowX: 'auto' }}>
          <div className={tabClass('preview')} onClick={() => setActiveTab('preview')}>
            <div className="flex items-center justify-center gap-2"><Search size={18} /> Xem trước</div>
          </div>
          <div className={tabClass('debug')} onClick={() => setActiveTab('debug')}>
            <div className="flex items-center justify-center gap-2"><Bug size={18} /> Debug</div>
          </div>
          <div className={tabClass('tweak')} onClick={() => setActiveTab('tweak')}>
            <div className="flex items-center justify-center gap-2"><SlidersHorizontal size={18} /> Tinh chỉnh</div>
          </div>
          <div className={tabClass('test')} onClick={() => setActiveTab('test')}>
            <div className="flex items-center justify-center gap-2"><Printer size={18} /> Test máy in</div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          
          {/* TAB 1: XEM TRƯỚC */}
          {activeTab === 'preview' && (
            <div className="flex flex-col items-center">
              <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                <h3 className="font-bold text-lg mb-2">Xem trước hóa đơn</h3>
                <p className="text-gray-500 text-sm">Hiển thị nguyên bản hóa đơn sẽ in ra giấy.</p>
              </div>
              <div style={{ padding: '2rem', background: '#e5e7eb', borderRadius: '0.5rem', width: '100%', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
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
          )}

          {/* TAB 2: DEBUG */}
          {activeTab === 'debug' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-lg mb-4">Chế độ gỡ lỗi (Debug)</h3>
                <p className="text-gray-500 text-sm mb-6">Bật khung viền đỏ để xem hóa đơn có bị lệch trái/phải, hay margin đẩy lề không.</p>
                
                <label className="flex items-center gap-3 p-4 bg-gray-50 border rounded-lg cursor-pointer hover:bg-gray-100 transition-colors mb-6">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                  />
                  <span className="font-medium text-red-600">Hiện khung debug (viền đỏ)</span>
                </label>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Thông số đo được:</h4>
                  <ul className="space-y-2 text-sm text-blue-900">
                    <li className="flex justify-between"><span>Khổ giấy đang cấu hình:</span> <strong>{settings.paper_size}</strong></li>
                    <li className="flex justify-between"><span>Chiều rộng thực tế:</span> <strong className={realWidth > 400 ? 'text-red-600' : ''}>{realWidth}px</strong></li>
                    <li className="flex justify-between"><span>Chiều cao thực tế:</span> <strong>{realHeight}px</strong></li>
                  </ul>
                  {realWidth > 400 && (
                    <div className="mt-3 p-2 bg-red-100 text-red-700 rounded text-xs">
                      ⚠️ Chiều rộng ({realWidth}px) đang quá lớn. Nếu in bị lỗi, có thể do CSS bị ghi đè.
                    </div>
                  )}
                  {realHeight > 5000 && (
                    <div className="mt-3 p-2 bg-red-100 text-red-700 rounded text-xs">
                      ⚠️ Chiều cao ({realHeight}px) bất thường. Kiểm tra lại margin/padding!
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-100 p-4 rounded-lg flex justify-center items-start overflow-hidden relative" style={{ minHeight: '400px' }}>
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
          )}

          {/* TAB 3: TINH CHỈNH */}
          {activeTab === 'tweak' && (
            <div className="max-w-xl mx-auto">
              <h3 className="font-bold text-lg mb-6 text-center">Tinh chỉnh thông số máy in</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block font-medium mb-3">Khổ giấy</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg flex-1 hover:bg-gray-50">
                      <input 
                        type="radio" 
                        name="paper_size" 
                        value="58mm" 
                        checked={settings.paper_size === '58mm'}
                        onChange={() => setSettings({ ...settings, paper_size: '58mm' })}
                      />
                      58mm (220px)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg flex-1 hover:bg-gray-50">
                      <input 
                        type="radio" 
                        name="paper_size" 
                        value="80mm" 
                        checked={settings.paper_size === '80mm'}
                        onChange={() => setSettings({ ...settings, paper_size: '80mm' })}
                      />
                      80mm (300px)
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium text-sm mb-1">Top Offset (px)</label>
                    <input 
                      type="number" 
                      className="input w-full" 
                      value={settings.top_offset}
                      onChange={(e) => setSettings({ ...settings, top_offset: parseInt(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-gray-500 mt-1 block">Vd: -80 đẩy lên</span>
                  </div>
                  <div>
                    <label className="block font-medium text-sm mb-1">Left Offset (px)</label>
                    <input 
                      type="number" 
                      className="input w-full" 
                      value={settings.left_offset}
                      onChange={(e) => setSettings({ ...settings, left_offset: parseInt(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-gray-500 mt-1 block">Vd: 10 dịch phải</span>
                  </div>
                  <div>
                    <label className="block font-medium text-sm mb-1">Scale (%)</label>
                    <input 
                      type="number" 
                      className="input w-full" 
                      value={settings.scale_percent}
                      onChange={(e) => setSettings({ ...settings, scale_percent: parseInt(e.target.value) || 100 })}
                    />
                    <span className="text-xs text-gray-500 mt-1 block">Vd: 95 thu nhỏ</span>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t">
                  <button onClick={handleReset} className="btn btn-outline flex-1">
                    <RefreshCw size={18} /> Khôi phục mặc định
                  </button>
                  <button onClick={handleSave} className="btn btn-primary flex-1" disabled={saving}>
                    <Save size={18} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình (DB)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEST MÁY IN */}
          {activeTab === 'test' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-lg mb-4 text-red-600 flex items-center gap-2">
                  <FileText size={20}/> Khắc phục lỗi khoảng trắng
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                  Sử dụng công cụ này để kiểm tra xem lỗi sinh ra do trình duyệt (WebApp) hay do Máy in (Driver).
                </p>
                
                <div className="bg-gray-100 p-4 rounded-lg mb-6">
                  <h4 className="font-semibold text-sm mb-2">Đo đạc DOM (WebApp):</h4>
                  <ul className="text-sm space-y-1">
                    <li>Khoảng cách từ mép trên (Top Gap): <strong className={topGap > 10 ? 'text-red-600' : 'text-green-600'}>{topGap}px</strong></li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    * Nếu Top Gap = 0px nhưng giấy in ra vẫn bị trắng 10cm, thì <strong>100% lỗi do Driver máy in hoặc lề Margin của trình duyệt khi ấn Print</strong>.
                  </p>
                </div>

                <div className="space-y-3">
                  <button onClick={() => handleTestPrint('58mm')} className="btn w-full justify-center bg-gray-800 text-white hover:bg-gray-900">
                    <Printer size={18} /> IN TEST KHỔ 58MM
                  </button>
                  <button onClick={() => handleTestPrint('80mm')} className="btn w-full justify-center bg-gray-800 text-white hover:bg-gray-900">
                    <Printer size={18} /> IN TEST KHỔ 80MM
                  </button>
                </div>
              </div>
              
              <div className="bg-gray-100 p-4 rounded-lg flex justify-center items-start overflow-hidden relative">
                {/* HÓA ĐƠN TEST MÁY IN (Rất tối giản) */}
                <div 
                  className="print-only inline-receipt" 
                  style={testStyles}
                  ref={testReceiptRef}
                >
                  <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>TOP MARK</h2>
                  </div>
                  
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <h3 style={{ margin: 0 }}>SPA & POS</h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>Bản in thử nghiệm lỗi</p>
                  </div>
                  
                  <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '10px', marginTop: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>BOTTOM MARK</h2>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
