import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useAuth } from '../lib/auth';

interface Props {
  shopId: string;
}

interface StaffData {
  id: string;
  full_name: string;
}

interface ExpenseData {
  salary: number;
  commission: number;
  tip: number;
  overtime: number;
  extraTime: number;
  tour: number;
  meal: number;
  kpi: number;
}

const DEFAULT_EXPENSE: ExpenseData = {
  salary: 0,
  commission: 0,
  tip: 0,
  overtime: 0,
  extraTime: 0,
  tour: 0,
  meal: 0,
  kpi: 0
};

const StaffExpensesTab: React.FC<Props> = ({ shopId }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [staffs, setStaffs] = useState<StaffData[]>([]);
  const [expenses, setExpenses] = useState<Record<string, ExpenseData>>({});
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const { profile } = useAuth();
  const isShopAdmin = profile?.role === 'shop_admin' || profile?.role === 'super_admin';



  if (!isShopAdmin) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Bạn không có quyền truy cập chức năng này.</div>;
  }

  useEffect(() => {
    fetchStaffs();
  }, [shopId]);

  useEffect(() => {
    loadSavedData();
  }, [shopId, selectedDate, staffs]);

  const fetchStaffs = async () => {
    setLoading(true);
    try {
      // 8. Log chính xác query Supabase đang chạy
      console.log(`
      QUERY ĐANG SỬ DỤNG ĐỂ DEBUG:
      supabase
        .from('staffs')
        .select('*')
        .eq('shop_id', '${shopId}')
      `);

      // 7. Log current shop_id
      console.log("7. Current shop_id:", shopId);

      // 8. Log current user role
      console.log("8. Current user role:", profile?.role);

      // KHÔNG SỬ DỤNG điều kiện position === 'Kỹ thuật viên'
      const { data, error } = await supabase
        .from('staffs')
        .select('*')
        .eq('shop_id', shopId);
        
      if (!error && data) {
        // 1. Log toàn bộ record trả về từ bảng staffs
        console.log("1. Toàn bộ record trả về từ bảng staffs:", data);

        // 2. Log toàn bộ giá trị position duy nhất
        const uniquePositions = [...new Set(data.map(s => s.position))];
        console.log("2. Toàn bộ giá trị position duy nhất:", uniquePositions);

        // 3. Log toàn bộ giá trị status duy nhất
        const uniqueStatuses = [...new Set(data.map(s => s.status))];
        console.log("3. Toàn bộ giá trị status duy nhất:", uniqueStatuses);

        // 4. Log toàn bộ giá trị is_active duy nhất
        const uniqueIsActive = [...new Set(data.map(s => s.is_active))];
        console.log("4. Toàn bộ giá trị is_active duy nhất:", uniqueIsActive);

        // 9. Log kết quả của position, position.trim(), position.toLowerCase()
        console.log("9. Kết quả xử lý chuỗi position:");
        data.forEach(s => {
          console.log({
            id: s.id,
            name: s.full_name,
            position: s.position,
            trimmed: s.position ? s.position.trim() : null,
            lower: s.position ? s.position.toLowerCase() : null
          });
        });

        // Filter để component chạy tiếp (sửa thành technician)
        const filteredData = data.filter(s => 
          s.position?.trim().toLowerCase() === 'technician' && 
          s.status === 'active'
        );

        console.log(`Before filter: ${data.length}`);
        console.log(`After filter: ${filteredData.length}`);

        setStaffs(filteredData as any);
      }
    } catch (err) {
      console.error('Error fetching staffs', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedData = () => {
    if (!shopId || !selectedDate || staffs.length === 0) return;
    const key = `staff_expenses_${shopId}_${selectedDate}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setExpenses(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved expenses', e);
        initializeEmptyExpenses();
      }
    } else {
      initializeEmptyExpenses();
    }
  };

  const initializeEmptyExpenses = () => {
    const initial: Record<string, ExpenseData> = {};
    staffs.forEach(s => {
      initial[s.id] = { ...DEFAULT_EXPENSE };
    });
    setExpenses(initial);
  };

  const handleInputChange = (staffId: string, field: keyof ExpenseData, value: string) => {
    const numValue = Number(value.replace(/\D/g, '')) || 0;
    const newExpenses = {
      ...expenses,
      [staffId]: {
        ...(expenses[staffId] || DEFAULT_EXPENSE),
        [field]: numValue
      }
    };
    setExpenses(newExpenses);
    
    // Auto save to local storage
    const key = `staff_expenses_${shopId}_${selectedDate}`;
    localStorage.setItem(key, JSON.stringify(newExpenses));
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount || 0);
  };

  const calculateTotal = (staffId: string) => {
    const data = expenses[staffId] || DEFAULT_EXPENSE;
    return Object.values(data).reduce((sum, val) => sum + (val || 0), 0);
  };

  const exportJPG = async (staffId: string, staffName: string) => {
    setExportingId(staffId);
    
    try {
      // Create a temporary hidden container to render the specific staff's column cleanly
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '400px';
      tempDiv.style.background = 'white';
      tempDiv.style.padding = '20px';
      tempDiv.style.borderRadius = '10px';
      tempDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
      tempDiv.style.fontFamily = 'sans-serif';
      tempDiv.style.color = '#333';
      
      const data = expenses[staffId] || DEFAULT_EXPENSE;
      const total = calculateTotal(staffId);
      const [y, m, d] = selectedDate.split('-');
      const formattedDate = `${d}/${m}/${y}`;

      tempDiv.innerHTML = `
        <div style="text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 15px; margin-bottom: 15px;">
          <h2 style="margin: 0; color: #4f46e5; font-size: 24px; text-transform: uppercase;">PHIẾU CHI TRẢ</h2>
          <div style="margin-top: 5px; font-size: 16px; color: #666;">Ngày: ${formattedDate}</div>
        </div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">
          Nhân viên: <span style="color: #4f46e5;">${staffName}</span>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 16px;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Lương:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.salary)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Hoa hồng:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.commission)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Tip:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.tip)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">N.Giờ:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.overtime)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Ngoài giờ:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.extraTime)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Tiền Tour:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.tour)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Tiền Ăn:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.meal)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">KPI:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.kpi)}</td>
          </tr>
        </table>
        
        <div style="margin-top: 20px; background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 16px; color: #ef4444; font-weight: bold; margin-bottom: 5px;">TỔNG NHẬN</div>
          <div style="font-size: 28px; font-weight: 900; color: #dc2626;">${formatMoney(total)}đ</div>
        </div>
      `;

      document.body.appendChild(tempDiv);

      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });

      document.body.removeChild(tempDiv);

      const image = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.href = image;
      link.download = `chi-tra-nhan-vien-${staffName.replace(/\s+/g, '-').toLowerCase()}-${selectedDate}.jpg`;
      link.click();

    } catch (err) {
      console.error('Error generating image', err);
      alert('Có lỗi xảy ra khi xuất ảnh!');
    } finally {
      setExportingId(null);
    }
  };

  const categories: { key: keyof ExpenseData; label: string }[] = [
    { key: 'salary', label: 'Lương' },
    { key: 'commission', label: 'H.Hồng' },
    { key: 'tip', label: 'Tip' },
    { key: 'overtime', label: 'N.Giờ' },
    { key: 'extraTime', label: 'Ngoài giờ' },
    { key: 'tour', label: 'T Tour' },
    { key: 'meal', label: 'T Ăn' },
    { key: 'kpi', label: 'KPI' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💰</span> Chi phí nhân viên
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Dữ liệu được lưu trữ độc lập trên thiết bị này theo từng ngày.
          </p>
        </div>
        <div>
          <input 
            type="date" 
            className="form-input" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ fontWeight: 'bold' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : staffs.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '1rem', color: 'var(--text-secondary)' }}>
          Không tìm thấy Kỹ thuật viên nào đang hoạt động.
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-card)', borderRadius: '0.5rem', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ display: 'table', width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
            <thead style={{ display: 'table-header-group', position: 'sticky', top: 0, zIndex: 20 }}>
              <tr style={{ display: 'table-row' }}>
                <th style={{ display: 'table-cell', position: 'sticky', left: 0, background: 'var(--bg-card)', padding: '1rem', borderBottom: '2px solid var(--border)', borderRight: '2px solid var(--border)', zIndex: 30, minWidth: '120px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  Khoản chi
                </th>
                {staffs.map(staff => (
                  <th key={staff.id} style={{ display: 'table-cell', padding: '1rem', background: 'var(--bg-card)', borderBottom: '2px solid var(--border)', textAlign: 'center', minWidth: '130px', color: 'var(--primary)', fontWeight: 'bold' }}>
                    {staff.full_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ display: 'table-row-group' }}>
              {categories.map((cat, index) => (
                <tr key={cat.key} style={{ display: 'table-row', background: index % 2 === 0 ? 'var(--bg-main)' : 'var(--bg-card)' }}>
                  <td style={{ display: 'table-cell', position: 'sticky', left: 0, background: index % 2 === 0 ? 'var(--bg-main)' : 'var(--bg-card)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '2px solid var(--border)', fontWeight: 'bold', color: 'var(--text-main)', zIndex: 10 }}>
                    {cat.label}
                  </td>
                  {staffs.map(staff => (
                    <td key={`${staff.id}-${cat.key}`} style={{ display: 'table-cell', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <input
                        type="number"
                        style={{ width: '100%', textAlign: 'right', fontWeight: 'bold', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-main)' }}
                        value={expenses[staff.id]?.[cat.key] || ''}
                        onChange={(e) => handleInputChange(staff.id, cat.key, e.target.value)}
                        placeholder="0"
                      />
                    </td>
                  ))}
                </tr>
              ))}
              
              {/* Hàng tổng */}
              <tr style={{ display: 'table-row' }}>
                <td style={{ display: 'table-cell', position: 'sticky', left: 0, background: '#fee2e2', padding: '1rem', borderBottom: '1px solid var(--border)', borderRight: '2px solid var(--border)', fontWeight: '900', color: '#dc2626', zIndex: 10, textTransform: 'uppercase' }}>
                  Tổng chi cho NV
                </td>
                {staffs.map(staff => {
                  const total = calculateTotal(staff.id);
                  return (
                    <td key={`total-${staff.id}`} style={{ display: 'table-cell', padding: '1rem', background: '#fee2e2', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: '900', color: '#dc2626', fontSize: '1.1rem' }}>
                      {formatMoney(total)}
                    </td>
                  );
                })}
              </tr>

              {/* Hàng nút xuất ảnh */}
              <tr style={{ display: 'table-row' }}>
                <td style={{ display: 'table-cell', position: 'sticky', left: 0, background: 'var(--bg-card)', padding: '1rem', borderRight: '2px solid var(--border)', fontWeight: 'bold', color: 'var(--text-secondary)', zIndex: 10 }}>
                  XUẤT DỮ LIỆU
                </td>
                {staffs.map(staff => (
                  <td key={`export-${staff.id}`} style={{ display: 'table-cell', padding: '1rem', textAlign: 'center', background: 'var(--bg-card)' }}>
                    <button
                      onClick={() => exportJPG(staff.id, staff.full_name)}
                      disabled={exportingId === staff.id}
                      style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {exportingId === staff.id ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                      Xuất JPG
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StaffExpensesTab;
