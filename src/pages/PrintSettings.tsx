import { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Printer, Search, Settings2, Bug, SlidersHorizontal, FileText, MonitorCheck, LayoutTemplate, MousePointer2 } from 'lucide-react';
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
  
  // Tabs: 'preview' | 'debug' | 'tweak' | 'test' | 'diagnostic'
  const [activeTab, setActiveTab] = useState<'preview' | 'debug' | 'tweak' | 'test' | 'diagnostic'>('preview');

  // Diagnostic states
  const [printMockStatus, setPrintMockStatus] = useState(false);
  const [testNotes, setTestNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('printer_test_notes');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { topGap: '', leftRightGap: '', notes: '' };
  });

  const updateTestNotes = (key: string, value: string) => {
    const newNotes = { ...testNotes, [key]: value };
    setTestNotes(newNotes);
    localStorage.setItem('printer_test_notes', JSON.stringify(newNotes));
  };

  const handlePrintTopMark = () => {
    const div = document.createElement('div');
    div.className = 'print-only print-test-top';
    div.style.position = 'absolute';
    div.style.top = '0px';
    div.style.left = '0px';
    div.style.fontSize = '16px';
    div.style.fontWeight = 'bold';
    div.innerText = 'TOP MARK';
    document.body.appendChild(div);

    const cleanup = () => {
      if (document.body.contains(div)) document.body.removeChild(div);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    
    window.scrollTo(0, 0);
    window.print();
  };

  const handlePrintBorder = () => {
    const div = document.createElement('div');
    div.className = 'print-only';
    div.style.width = settings?.paper_size === '58mm' ? '220px' : '300px';
    div.style.border = '2px solid black';
    div.style.padding = '10px';
    div.style.margin = '0 auto';
    div.style.textAlign = 'center';
    div.style.fontWeight = 'bold';
    div.innerText = 'TEST BORDER';
    document.body.appendChild(div);

    const cleanup = () => {
      if (document.body.contains(div)) document.body.removeChild(div);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.scrollTo(0, 0);
    window.print();
  };

  const handlePrintMockInvoice = () => {
    setPrintMockStatus(true);
    setTimeout(() => {
      window.scrollTo(0, 0);
      window.print();
      setTimeout(() => setPrintMockStatus(false), 500);
    }, 500);
  };
  
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
      // Optional: Add a nice toast instead of alert
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
    const oldSize = settings?.paper_size;
    if (settings) {
      setSettings({ ...settings, paper_size: size });
    }
    
    setTimeout(() => {
      window.print();
      if (settings && oldSize) {
        setTimeout(() => setSettings({ ...settings, paper_size: oldSize }), 100);
      }
    }, 100);
  };

  if (loading || !settings) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="font-medium animate-pulse">Đang tải cấu hình máy in...</p>
      </div>
    );
  }

  const mockInvoice = {
    invoice_code: 'TEST-001',
    customer_name: 'Khách test',
    customer_phone: '0901234567',
    staff_name: profile?.full_name || 'Nhân viên',
    created_at: new Date().toISOString(),
    is_use_package: false,
    items: [
      { name: 'Dịch vụ Massage VIP', price: 100000 },
      { name: 'Xông hơi khô', price: 99000 }
    ],
    total_amount: 199000,
    discount_amount: 0,
    final_amount: 199000
  };

  const mockConfig = {
    shop_name: profile?.shop?.name || 'SPA & POS PREMIUM',
    address: '123 Đường Ngọc Trai, Phường 1, Quận 1',
    phone: '0123 456 789'
  };

  const testPaperWidth = settings.paper_size === '58mm' ? '220px' : '300px';
  const testStyles: any = {
    width: testPaperWidth,
    margin: '0 auto',
    background: 'white',
    padding: '20px',
    fontFamily: 'monospace',
    color: '#111827',
    position: 'relative',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '8px', // slightly rounded for UI preview only
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
    testStyles.border = '2px dashed #EF4444';
    testStyles.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.1)';
  }

  const tabs = [
    { id: 'preview', label: 'Xem trước', icon: Search, desc: 'Hiển thị nguyên bản hóa đơn' },
    { id: 'debug', label: 'Debug', icon: Bug, desc: 'Đo lường & Gỡ lỗi lề' },
    { id: 'tweak', label: 'Tinh chỉnh', icon: SlidersHorizontal, desc: 'Tọa độ & Kích thước' },
    { id: 'test', label: 'In Test', icon: Printer, desc: 'Bài test máy in chuẩn' },
    { id: 'diagnostic', label: '🧪 Test máy in', icon: MonitorCheck, desc: 'Kiểm tra chẩn đoán' }
  ] as const;

  return (
    <div className="animate-fade pb-20 bg-gray-50/50 min-h-full">
      {/* HEDER */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <Settings2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Cài Đặt Máy In</h1>
              <p className="text-gray-500 text-sm mt-0.5">Tinh chỉnh và khắc phục lỗi khổ giấy / khoảng trắng</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Save size={18} /> {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-8">
        {/* SEGMENTED TAB BAR */}
        <div className="bg-gray-100/80 backdrop-blur-md p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap gap-1.5 mb-8 border shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ease-out outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                  ${isActive 
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50 scale-[1.02]' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                  }
                `}
              >
                <Icon size={18} className={isActive ? 'text-primary' : 'text-gray-400'} />
                <div className="text-center sm:text-left">
                  <div className="whitespace-nowrap">{tab.label}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* TAB CONTENTS - Dùng card chung để bọc nội dung */}
        <div className="bg-white rounded-2xl shadow-sm border p-1 border-gray-200">
          <div className="bg-white rounded-xl p-6 md:p-8">
            
            {/* TAB 1: XEM TRƯỚC */}
            {activeTab === 'preview' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="text-center max-w-2xl mx-auto mb-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-4">
                    <Search size={24} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Xem trước hóa đơn</h3>
                  <p className="text-gray-500">Đây là bản xem trước hiển thị chính xác những gì sẽ xuất hiện trên khổ giấy máy in của bạn.</p>
                </div>
                
                <div className="bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] bg-gray-50 rounded-2xl border flex items-center justify-center p-8 md:p-12 min-h-[500px]">
                  <div className="relative group">
                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-100 to-primary/20 blur-xl opacity-0 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 rounded-3xl"></div>
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
            )}

            {/* TAB 2: DEBUG */}
            {activeTab === 'debug' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 grid lg:grid-cols-12 gap-8 items-start">
                
                <div className="lg:col-span-5 space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Bug className="text-red-500" /> Chế độ Gỡ lỗi
                    </h3>
                    <p className="text-gray-500">Kích hoạt khung viền để kiểm tra sự cố lệch lề hoặc dư khoảng trắng do CSS container.</p>
                  </div>
                  
                  <label className="group relative flex items-center justify-between p-5 bg-white border-2 border-gray-100 hover:border-red-200 rounded-2xl cursor-pointer transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${debugMode ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                        <LayoutTemplate size={24} />
                      </div>
                      <div>
                        <div className={`font-bold ${debugMode ? 'text-red-600' : 'text-gray-700'}`}>Hiện viền đỏ (Debug)</div>
                        <div className="text-xs text-gray-400 mt-0.5">Kiểm tra đường biên thực tế</div>
                      </div>
                    </div>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${debugMode ? 'bg-red-500' : 'bg-gray-200'}`}>
                      <input type="checkbox" className="sr-only" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} />
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${debugMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </label>

                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/5 blur-2xl"></div>
                    
                    <h4 className="font-medium text-gray-300 mb-4 flex items-center gap-2">
                      <MonitorCheck size={18} /> Thông số Render thực tế
                    </h4>
                    
                    <div className="space-y-4">
                      <div className="bg-black/30 rounded-xl p-3 flex justify-between items-center backdrop-blur-sm border border-white/5">
                        <span className="text-gray-400 text-sm">Khổ giấy gốc</span>
                        <span className="font-mono font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{settings.paper_size}</span>
                      </div>
                      
                      <div className="bg-black/30 rounded-xl p-3 flex justify-between items-center backdrop-blur-sm border border-white/5">
                        <span className="text-gray-400 text-sm">Chiều rộng</span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded ${realWidth > 400 ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'}`}>
                          {realWidth}px
                        </span>
                      </div>
                      
                      <div className="bg-black/30 rounded-xl p-3 flex justify-between items-center backdrop-blur-sm border border-white/5">
                        <span className="text-gray-400 text-sm">Chiều cao</span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded ${realHeight > 5000 ? 'text-orange-400 bg-orange-400/10' : 'text-gray-100 bg-white/10'}`}>
                          {realHeight}px
                        </span>
                      </div>
                    </div>

                    {(realWidth > 400 || realHeight > 5000) && (
                      <div className="mt-5 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm flex gap-2">
                        <Bug size={16} className="shrink-0 mt-0.5" />
                        <p>Cảnh báo: Kích thước DOM vượt ngưỡng in thông thường. Khả năng cao do flex/grid bị bung.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNFMkU4RjAiLz48L3N2Zz4=')] border rounded-3xl p-8 flex justify-center items-start min-h-[600px] overflow-auto shadow-inner relative">
                  <div className="absolute top-4 left-4 bg-white/80 backdrop-blur text-xs font-mono px-3 py-1.5 rounded border text-gray-500 shadow-sm flex items-center gap-2">
                    <MousePointer2 size={12}/> Live Preview
                  </div>
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
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-3xl mx-auto py-4">
                <div className="text-center mb-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Canh Lề & Kích Thước</h3>
                  <p className="text-gray-500">Bù trừ sai số từ Driver máy in bằng cách dịch chuyển trực tiếp gốc toạ độ của WebApp.</p>
                </div>
                
                <div className="bg-white border rounded-3xl p-6 md:p-10 shadow-sm mb-8 space-y-10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-400 to-cyan-400"></div>
                  
                  {/* Khổ giấy */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
                      <FileText size={16} className="text-primary"/> 1. Chọn Khổ Giấy
                    </label>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {['58mm', '80mm'].map((size) => {
                        const isSelected = settings.paper_size === size;
                        return (
                          <label 
                            key={size}
                            className={`group relative flex flex-col p-5 border-2 rounded-2xl cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`font-bold text-lg ${isSelected ? 'text-primary' : 'text-gray-700'}`}>{size}</span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-gray-300'}`}>
                                {isSelected && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                              </div>
                            </div>
                            <span className="text-sm text-gray-500">Chuẩn {size === '58mm' ? '~220px' : '~300px'}</span>
                            <input 
                              type="radio" 
                              name="paper_size" 
                              value={size} 
                              checked={isSelected}
                              onChange={() => setSettings({ ...settings, paper_size: size as any })}
                              className="sr-only"
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Offset & Scale */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">
                      <SlidersHorizontal size={16} className="text-primary"/> 2. Tinh chỉnh Tọa độ
                    </label>
                    <div className="grid md:grid-cols-3 gap-6">
                      
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors group">
                        <label className="block font-medium text-gray-700 text-sm mb-1 group-focus-within:text-blue-600 transition-colors">Dịch Trên (Top)</label>
                        <div className="relative mt-2">
                          <input 
                            type="number" 
                            className="w-full bg-white border border-gray-300 text-gray-900 text-lg rounded-xl focus:ring-primary focus:border-primary block px-4 py-3 shadow-sm"
                            value={settings.top_offset}
                            onChange={(e) => setSettings({ ...settings, top_offset: parseInt(e.target.value) || 0 })}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400 font-mono text-sm">px</div>
                        </div>
                        <span className="text-xs text-gray-500 mt-2 block">Nhập <b>số âm</b> để kéo lên (-80px)</span>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors group">
                        <label className="block font-medium text-gray-700 text-sm mb-1 group-focus-within:text-blue-600 transition-colors">Dịch Trái (Left)</label>
                        <div className="relative mt-2">
                          <input 
                            type="number" 
                            className="w-full bg-white border border-gray-300 text-gray-900 text-lg rounded-xl focus:ring-primary focus:border-primary block px-4 py-3 shadow-sm"
                            value={settings.left_offset}
                            onChange={(e) => setSettings({ ...settings, left_offset: parseInt(e.target.value) || 0 })}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400 font-mono text-sm">px</div>
                        </div>
                        <span className="text-xs text-gray-500 mt-2 block">Dịch nội dung qua phải/trái</span>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors group">
                        <label className="block font-medium text-gray-700 text-sm mb-1 group-focus-within:text-blue-600 transition-colors">Tỷ lệ Thu/Phóng</label>
                        <div className="relative mt-2">
                          <input 
                            type="number" 
                            className="w-full bg-white border border-gray-300 text-gray-900 text-lg rounded-xl focus:ring-primary focus:border-primary block px-4 py-3 shadow-sm"
                            value={settings.scale_percent}
                            onChange={(e) => setSettings({ ...settings, scale_percent: parseInt(e.target.value) || 100 })}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400 font-mono text-sm">%</div>
                        </div>
                        <span className="text-xs text-gray-500 mt-2 block">Thu nhỏ nếu tràn viền (VD: 95)</span>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button onClick={handleReset} className="px-8 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2">
                    <RefreshCw size={18} /> Đặt lại mặc định
                  </button>
                  <button onClick={handleSave} disabled={saving} className="px-10 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:scale-100">
                    <Save size={18} /> {saving ? 'Đang lưu...' : 'Cập nhật Hệ thống'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: TEST MÁY IN */}
            {activeTab === 'test' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 grid lg:grid-cols-12 gap-10 items-start">
                
                <div className="lg:col-span-6 space-y-8">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-bold mb-4 border border-orange-200">
                      <Bug size={14} /> CÔNG CỤ CHUẨN ĐOÁN
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Kiểm tra Mạch cứng</h3>
                    <p className="text-gray-600 leading-relaxed text-lg">
                      Sử dụng mẫu test cực kì tối giản để truy tìm thủ phạm tạo ra khoảng trắng: do <strong>Trình duyệt</strong> hay do <strong>Driver máy in</strong>.
                    </p>
                  </div>

                  <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-6 hover:border-blue-300 transition-colors group">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">1</div>
                      Đọc thông số DOM trình duyệt
                    </h4>
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <span className="font-medium text-gray-600">Khoảng cách từ mép trên cùng (Top Gap)</span>
                      <span className={`text-2xl font-black tracking-tight ${topGap > 5 ? 'text-red-500' : 'text-green-600'}`}>{topGap}px</span>
                    </div>
                    <div className="mt-4 text-sm text-gray-500 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                      <strong className="text-gray-700">Luật kiểm chứng:</strong> Nếu Top Gap = <strong className="text-green-600">0px</strong> nhưng in ra giấy thật vẫn bị trắng 1 đoạn dài phía trên ➔ <strong>100% lỗi từ setting Margin của Driver máy in</strong>.
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">2</div>
                      Phát lệnh in thử nghiệm
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <button 
                        onClick={() => handleTestPrint('58mm')} 
                        className="group relative flex flex-col items-center justify-center gap-2 p-6 bg-gray-900 hover:bg-black text-white rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-900/20"
                      >
                        <Printer size={32} className="text-gray-400 group-hover:text-white transition-colors" />
                        <span className="font-bold tracking-wide">IN TEST 58MM</span>
                        <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-focus:ring-blue-500"></div>
                      </button>
                      <button 
                        onClick={() => handleTestPrint('80mm')} 
                        className="group relative flex flex-col items-center justify-center gap-2 p-6 bg-gray-900 hover:bg-black text-white rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-900/20"
                      >
                        <Printer size={32} className="text-gray-400 group-hover:text-white transition-colors" />
                        <span className="font-bold tracking-wide">IN TEST 80MM</span>
                        <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-focus:ring-blue-500"></div>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="lg:col-span-6 bg-gradient-to-br from-gray-100 to-gray-200 p-8 rounded-3xl min-h-[600px] flex items-center justify-center shadow-inner relative">
                  
                  <div className="absolute top-6 flex w-full justify-center opacity-50 font-mono text-xs text-gray-400 uppercase tracking-widest">
                    Mô phỏng máy in
                  </div>

                  {/* HÓA ĐƠN TEST MÁY IN (Rất tối giản) */}
                  <div 
                    className="print-only inline-receipt relative" 
                    style={testStyles}
                    ref={testReceiptRef}
                  >
                    <div className="absolute -top-3 -left-3 -right-3 -bottom-3 border-2 border-dashed border-gray-200 rounded-xl pointer-events-none hidden md:block"></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 uppercase tracking-wider font-sans whitespace-nowrap hidden md:block">Gốc toạ độ Browser (Top: 0)</div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-red-400 hidden md:block"></div>

                    <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '15px', marginBottom: '20px' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '2px' }}>TOP MARK</h2>
                    </div>
                    
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>SPA & POS</h3>
                      <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#666' }}>Bản in thử nghiệm kiểm tra lỗi</p>
                      
                      <div style={{ marginTop: '20px', padding: '10px', background: '#f8f8f8', border: '1px solid #eee', fontSize: '11px', textAlign: 'left' }}>
                        <div>Khổ: <strong>{settings.paper_size}</strong></div>
                        <div>Top Offset: <strong>{settings.top_offset}px</strong></div>
                        <div>Scale: <strong>{settings.scale_percent}%</strong></div>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'center', borderTop: '2px dashed #000', paddingTop: '15px', marginTop: '20px' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '2px' }}>BOTTOM MARK</h2>
                    </div>
                  </div>

                </div>
              </div>
            {/* TAB 5: DIAGNOSTIC (TEST MÁY IN) */}
            {activeTab === 'diagnostic' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-4xl mx-auto space-y-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Công cụ chẩn đoán máy in nhiệt</h3>
                  <p className="text-gray-500">Thực hiện các bài test tối giản để tìm ra nguyên nhân gây lệch khổ giấy, dư khoảng trắng.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <button onClick={handlePrintTopMark} className="p-6 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl flex flex-col items-center gap-3 transition-colors">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                    <span className="font-bold text-blue-900">IN TOP MARK</span>
                    <span className="text-xs text-center text-blue-700">In chữ sát mép giấy (position: absolute; top: 0). Dùng để phát hiện khoảng trắng do máy in tự chừa.</span>
                  </button>
                  <button onClick={handlePrintBorder} className="p-6 bg-green-50 hover:bg-green-100 border border-green-200 rounded-2xl flex flex-col items-center gap-3 transition-colors">
                    <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                    <span className="font-bold text-green-900">IN KHUNG TEST</span>
                    <span className="text-xs text-center text-green-700">In ra khung viền với độ rộng thực tế ({settings.paper_size}). Giúp phát hiện sai lệch trái phải.</span>
                  </button>
                  <button onClick={handlePrintMockInvoice} className="p-6 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-2xl flex flex-col items-center gap-3 transition-colors">
                    <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                    <span className="font-bold text-purple-900">IN HÓA ĐƠN MẪU</span>
                    <span className="text-xs text-center text-purple-700">Sử dụng dữ liệu giả (SHOP TEST, Khách test) đi qua ReceiptTemplate thực tế.</span>
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-8">
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-4 border-b pb-2">THÔNG TIN DEBUG</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Khổ giấy:</span><strong className="text-gray-900">{settings.paper_size}</strong></div>
                      <div className="flex justify-between"><span className="text-gray-500">Top Offset:</span><strong className="text-gray-900">{settings.top_offset || 0}px</strong></div>
                      <div className="flex justify-between"><span className="text-gray-500">Left Offset:</span><strong className="text-gray-900">{settings.left_offset || 0}px</strong></div>
                      <div className="flex justify-between"><span className="text-gray-500">Scale:</span><strong className="text-gray-900">{settings.scale_percent || 100}%</strong></div>
                      <div className="flex justify-between"><span className="text-gray-500">Chiều rộng Browser:</span><strong className="text-gray-900">{window.innerWidth}px</strong></div>
                    </div>
                  </div>

                  <div className="bg-yellow-50/50 p-6 rounded-2xl border border-yellow-200">
                    <h4 className="font-bold text-gray-900 mb-4 border-b pb-2">KẾT QUẢ TEST (Lưu LocalStorage)</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Khoảng trắng đầu giấy:</label>
                        <input type="text" value={testNotes.topGap} onChange={e => updateTestNotes('topGap', e.target.value)} className="w-full form-input bg-white border-yellow-300" placeholder="VD: Bị dư 2cm..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Lệch trái/phải:</label>
                        <input type="text" value={testNotes.leftRightGap} onChange={e => updateTestNotes('leftRightGap', e.target.value)} className="w-full form-input bg-white border-yellow-300" placeholder="VD: Lệch sang phải..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nhận xét tổng quan:</label>
                        <textarea value={testNotes.notes} onChange={e => updateTestNotes('notes', e.target.value)} className="w-full form-input bg-white border-yellow-300" rows={2} placeholder="Nhận định nguyên nhân..."></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      
      {/* Hidden Portal cho in Hóa đơn mẫu */}
      {printMockStatus && (
        <ReceiptTemplate 
          invoice={{
            invoice_code: 'TEST-123',
            customer_name: 'Khách test',
            customer_phone: '',
            staff_name: 'System',
            created_at: new Date().toISOString(),
            is_use_package: false,
            items: [{ name: 'Dịch vụ test', price: 199000 }],
            total_amount: 199000,
            discount_amount: 0,
            final_amount: 199000
          }}
          config={{
            shop_name: 'SHOP TEST',
            paper_size: settings.paper_size
          }}
          printSettings={settings}
          renderInline={false} // Bắt buộc render ra Portal để in
        />
      )}
    </div>
  );
}
