import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Loader2, Plus, Unlock } from 'lucide-react';
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
  bonus: number;
  tip: number;
  bonusTip: number;
  overtime: number;
  overtimeMoney: number;
  bonusOvertime: number;
  tour: number;
  bonusTour: number;
  meal: number;
  bonusMeal: number;
  kpi: number;
  support: number;
}

const DEFAULT_EXPENSE: ExpenseData = {
  salary: 0,
  commission: 0,
  bonus: 0,
  tip: 0,
  bonusTip: 0,
  overtime: 0,
  overtimeMoney: 0,
  bonusOvertime: 0,
  tour: 0,
  bonusTour: 0,
  meal: 0,
  bonusMeal: 0,
  kpi: 0,
  support: 0
};

const StaffExpensesTab: React.FC<Props> = ({ shopId }) => {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [staffs, setStaffs] = useState<StaffData[]>([]);
  const [expenses, setExpenses] = useState<Record<string, ExpenseData>>({});
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [unlockedRows, setUnlockedRows] = useState<Record<string, boolean>>({});

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
  }, [shopId, startDate, endDate, staffs]);

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
    if (!shopId || !startDate || !endDate || staffs.length === 0) return;
    const key = `staff_expenses_${shopId}_${startDate}_${endDate}`;
    const saved = localStorage.getItem(key);
    let currentExpenses = { ...expenses };
    if (saved) {
      try {
        currentExpenses = JSON.parse(saved);
        setExpenses(currentExpenses);
      } catch (e) {
        console.error('Error parsing saved expenses', e);
        initializeEmptyExpenses();
      }
    } else {
      initializeEmptyExpenses();
    }
    
    // Tự động lấy hoa hồng và thu nhập KTV cho khoảng thời gian
    const fetchData = async () => {
      try {
        const sdObj = new Date(`${startDate}T00:00:00`);
        const edObj = new Date(`${endDate}T23:59:59.999`);
        const startStr = sdObj.toISOString();
        const endStr = edObj.toISOString();

        // 1. Fetch commission_logs
        const { data: commData } = await supabase
          .from('commission_logs')
          .select('staff_id, amount')
          .eq('shop_id', shopId)
          .neq('status', 'cancelled')
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        const commMap = new Map<string, number>();
        commData?.forEach(c => {
          commMap.set(c.staff_id, (commMap.get(c.staff_id) || 0) + Number(c.amount));
        });

        // 2. Fetch staff_daily_income
        const { data: incData } = await supabase
          .from('staff_daily_income')
          .select('staff_name, tip_amount, tour_amount, overtime_minutes, meal_amount')
          .eq('shop_id', shopId)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        const incomeMap = new Map<string, { tip: number, tour: number, overtime: number, meal: number }>();
        incData?.forEach(inc => {
          const current = incomeMap.get(inc.staff_name) || { tip: 0, tour: 0, overtime: 0, meal: 0 };
          current.tip += Number(inc.tip_amount) || 0;
          current.tour += Number(inc.tour_amount) || 0;
          current.overtime += Number(inc.overtime_minutes) || 0;
          current.meal += Number(inc.meal_amount) || 0;
          incomeMap.set(inc.staff_name, current);
        });
        
        setExpenses(prev => {
          const next = { ...prev };
          let hasChanges = false;
          staffs.forEach(s => {
            if (!next[s.id]) next[s.id] = { ...DEFAULT_EXPENSE };
            const newComm = commMap.get(s.id) || 0;
            const staffInc = incomeMap.get(s.full_name) || { tip: 0, tour: 0, overtime: 0, meal: 0 };

            if (next[s.id].commission !== newComm) { next[s.id].commission = newComm; hasChanges = true; }
            if (next[s.id].tip !== staffInc.tip) { next[s.id].tip = staffInc.tip; hasChanges = true; }
            if (next[s.id].tour !== staffInc.tour) { next[s.id].tour = staffInc.tour; hasChanges = true; }
            if (next[s.id].overtime !== staffInc.overtime) { next[s.id].overtime = staffInc.overtime; hasChanges = true; }
            const calcOvertimeMoney = Math.round((staffInc.overtime / 60) * 25000);
            if (next[s.id].overtimeMoney !== calcOvertimeMoney) { next[s.id].overtimeMoney = calcOvertimeMoney; hasChanges = true; }
            if (next[s.id].meal !== staffInc.meal) { next[s.id].meal = staffInc.meal; hasChanges = true; }
          });
          if (hasChanges) {
            localStorage.setItem(key, JSON.stringify(next));
          }
          return next;
        });
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    
    fetchData();
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
    const key = `staff_expenses_${shopId}_${startDate}_${endDate}`;
    localStorage.setItem(key, JSON.stringify(newExpenses));
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount || 0);
  };

  const calculateTotal = (staffId: string) => {
    const data = expenses[staffId] || DEFAULT_EXPENSE;
    let total = 0;
    (Object.keys(data) as Array<keyof ExpenseData>).forEach(k => {
      if (k !== 'overtime') {
        total += data[k] || 0;
      }
    });
    return total;
  };

  const formatInputValue = (val: number | undefined, key: string) => {
    if (!val) return '';
    if (key === 'overtime') return val.toString();
    return new Intl.NumberFormat('vi-VN').format(val);
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
      const formattedDate = `${startDate.split('-').reverse().join('/')} - ${endDate.split('-').reverse().join('/')}`;

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
            <td style="padding: 10px 0; color: #555;">&nbsp;</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.bonus)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Tip:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.tip)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">&nbsp;</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.bonusTip)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">N.Giờ (phút):</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${data.overtime}p</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Tiền N.Giờ:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.overtimeMoney)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">&nbsp;</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.bonusOvertime)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Tiền Tour:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.tour)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">&nbsp;</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.bonusTour)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Tiền Ăn:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.meal)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">&nbsp;</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.bonusMeal)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">KPI:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.kpi)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; color: #555;">Hỗ trợ:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatMoney(data.support)}</td>
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
      link.download = `chi-tra-nhan-vien-${staffName.replace(/\s+/g, '-').toLowerCase()}-${startDate}-to-${endDate}.jpg`;
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
    { key: 'bonus', label: ' ' },
    { key: 'tip', label: 'Tip' },
    { key: 'bonusTip', label: ' ' },
    { key: 'overtime', label: 'N.Giờ (phút)' },
    { key: 'overtimeMoney', label: 'Tiền N.Giờ' },
    { key: 'bonusOvertime', label: ' ' },
    { key: 'tour', label: 'T Tour' },
    { key: 'bonusTour', label: ' ' },
    { key: 'meal', label: 'T Ăn' },
    { key: 'bonusMeal', label: ' ' },
    { key: 'kpi', label: 'KPI' },
    { key: 'support', label: 'Hỗ trợ' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💰</span> Chi phí nhân viên
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Dữ liệu được lưu trữ độc lập trên thiết bị này theo khoảng thời gian.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap', minHeight: 'auto' }}
            onClick={() => {
              const d = new Date();
              setStartDate(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]);
              setEndDate(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]);
            }}
          >
            Tháng trước
          </button>
          <button
            className="btn btn-primary"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap', minHeight: 'auto' }}
            onClick={() => {
              const d = new Date();
              setStartDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]);
              setEndDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]);
            }}
          >
            Tháng này
          </button>
          <input 
            type="date" 
            className="form-input" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ fontWeight: 'bold', padding: '0.3rem', fontSize: '0.75rem', minHeight: 'auto', width: 'auto' }}
          />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>đến</span>
          <input 
            type="date" 
            className="form-input" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ fontWeight: 'bold', padding: '0.3rem', fontSize: '0.75rem', minHeight: 'auto', width: 'auto' }}
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
          <table style={{ display: 'table', width: 'auto', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.75rem', margin: '0' }}>
            <thead style={{ display: 'table-header-group', position: 'sticky', top: 0, zIndex: 20 }}>
              <tr style={{ display: 'table-row' }}>
                <th style={{ display: 'table-cell', position: 'sticky', left: 0, background: 'var(--bg-card)', padding: '0.2rem', borderBottom: '2px solid var(--border)', borderRight: '2px solid var(--border)', zIndex: 30, width: '70px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  Khoản chi
                </th>
                {staffs.map(staff => (
                  <th key={staff.id} style={{ display: 'table-cell', padding: '0.2rem', background: 'var(--bg-card)', borderBottom: '2px solid var(--border)', textAlign: 'center', width: '55px', color: 'var(--primary)', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {staff.full_name}
                  </th>
                ))}
                <th style={{ display: 'table-cell', position: 'sticky', right: 0, background: 'var(--bg-card)', padding: '0.2rem', borderBottom: '2px solid var(--border)', borderLeft: '2px solid var(--border)', zIndex: 30, width: '35px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Sửa
                </th>
              </tr>
            </thead>
            <tbody style={{ display: 'table-row-group' }}>
              {categories.map((cat, index) => {
                let rowBg = index % 2 === 0 ? 'var(--bg-main)' : 'var(--bg-card)';
                if (['commission', 'bonus'].includes(cat.key)) rowBg = 'rgba(236, 72, 153, 0.05)';
                if (['tip', 'bonusTip'].includes(cat.key)) rowBg = 'rgba(34, 197, 94, 0.05)';
                if (['overtime', 'overtimeMoney', 'bonusOvertime'].includes(cat.key)) rowBg = 'rgba(234, 179, 8, 0.1)';
                if (['tour', 'bonusTour'].includes(cat.key)) rowBg = 'rgba(59, 130, 246, 0.05)';
                if (['meal', 'bonusMeal'].includes(cat.key)) rowBg = 'rgba(249, 115, 22, 0.05)';
                
                const isAuto = ['commission', 'tip', 'tour', 'overtime', 'overtimeMoney', 'meal'].includes(cat.key);
                return (
                <tr key={cat.key} style={{ display: 'table-row', background: rowBg }}>
                  <td style={{ display: 'table-cell', position: 'sticky', left: 0, background: rowBg, padding: '0.2rem', borderBottom: '1px solid var(--border)', borderRight: '2px solid var(--border)', fontWeight: 'bold', color: 'var(--text-main)', zIndex: 10 }}>
                    {cat.label}
                  </td>
                  {staffs.map(staff => {
                    const isReadOnly = isAuto && !unlockedRows[cat.key];
                    return (
                      <td key={`${staff.id}-${cat.key}`} style={{ display: 'table-cell', padding: '0.1rem', borderBottom: '1px solid var(--border)' }}>
                        <input
                          type="text"
                          className="no-spin"
                          style={{ 
                            width: '100%', 
                            textAlign: 'right', 
                            fontWeight: 'bold', 
                            padding: '0.1rem', 
                            border: '1px solid var(--border)', 
                            borderRadius: '2px', 
                            background: isAuto ? (isReadOnly ? 'rgba(0,0,0,0.03)' : 'var(--bg-main)') : 'var(--bg-main)', 
                            fontSize: '0.75rem',
                            color: isAuto ? (isReadOnly ? 'var(--primary)' : 'inherit') : 'inherit',
                            cursor: isReadOnly ? 'not-allowed' : 'text'
                          }}
                          value={formatInputValue(expenses[staff.id]?.[cat.key], cat.key)}
                          onChange={(e) => handleInputChange(staff.id, cat.key, e.target.value)}
                          placeholder="0"
                          readOnly={isReadOnly}
                        />
                      </td>
                    );
                  })}
                  <td style={{ display: 'table-cell', position: 'sticky', right: 0, background: rowBg, padding: '0.1rem', borderBottom: '1px solid var(--border)', borderLeft: '2px solid var(--border)', textAlign: 'center', zIndex: 10 }}>
                    <button 
                      onClick={() => setUnlockedRows(prev => ({...prev, [cat.key]: !prev[cat.key]}))}
                      title={isAuto ? "Mở khóa để sửa tay" : "Cố định/Sửa"}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.2rem', color: unlockedRows[cat.key] ? 'var(--success)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                    >
                      {unlockedRows[cat.key] ? <Unlock size={14} /> : <Plus size={14} />}
                    </button>
                  </td>
                </tr>
              )})}
              
              {/* Hàng tổng */}
              <tr style={{ display: 'table-row' }}>
                <td style={{ display: 'table-cell', position: 'sticky', left: 0, background: '#fee2e2', padding: '0.2rem', borderBottom: '1px solid var(--border)', borderRight: '2px solid var(--border)', fontWeight: '900', color: '#dc2626', zIndex: 10, textTransform: 'uppercase' }}>
                  Tổng
                </td>
                {staffs.map(staff => {
                  const total = calculateTotal(staff.id);
                  return (
                    <td key={`total-${staff.id}`} style={{ display: 'table-cell', padding: '0.2rem', background: '#fee2e2', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: '900', color: '#dc2626', fontSize: '0.8rem' }}>
                      {formatMoney(total)}
                    </td>
                  );
                })}
                <td style={{ display: 'table-cell', position: 'sticky', right: 0, background: '#fee2e2', padding: '0.2rem', borderBottom: '1px solid var(--border)', borderLeft: '2px solid var(--border)', zIndex: 10 }}></td>
              </tr>

              {/* Hàng nút xuất ảnh */}
              <tr style={{ display: 'table-row' }}>
                <td style={{ display: 'table-cell', position: 'sticky', left: 0, background: 'var(--bg-card)', padding: '0.2rem', borderRight: '2px solid var(--border)', fontWeight: 'bold', color: 'var(--text-secondary)', zIndex: 10 }}>
                  Xuất
                </td>
                {staffs.map(staff => (
                  <td key={`export-${staff.id}`} style={{ display: 'table-cell', padding: '0.1rem', textAlign: 'center', background: 'var(--bg-card)' }}>
                    <button
                      onClick={() => exportJPG(staff.id, staff.full_name)}
                      disabled={exportingId === staff.id}
                      style={{ width: '100%', padding: '0.2rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {exportingId === staff.id ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                      JPG
                    </button>
                  </td>
                ))}
                <td style={{ display: 'table-cell', position: 'sticky', right: 0, padding: '0.1rem', background: 'var(--bg-card)', borderLeft: '2px solid var(--border)', zIndex: 10 }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StaffExpensesTab;
