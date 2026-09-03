import React, { useState, useEffect, useRef } from 'react';
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

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const StaffExpensesTab: React.FC<Props> = ({ shopId }) => {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return formatLocalDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  });
  const [staffs, setStaffs] = useState<StaffData[]>([]);
  const [expenses, setExpenses] = useState<Record<string, ExpenseData>>({});
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [unlockedRows, setUnlockedRows] = useState<Record<string, boolean>>({});

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const { data, error } = await supabase
        .from('staffs')
        .select('*')
        .eq('shop_id', shopId);
        
      if (!error && data) {
        const isTechnician = (pos?: string) => {
          if (!pos) return true; // nếu chưa set position thì mặc định hiển thị
          const p = pos.trim().toLowerCase();
          return p === 'technician' || p === 'ktv' || p === 'kỹ thuật viên' || p === 'tour' || p === 'staff';
        };

        const filteredData = data.filter(s => 
          isTechnician(s.position) && 
          (s.status === 'active' || s.is_active === true || (!s.status && s.is_active !== false))
        );

        setStaffs(filteredData as any);
      }
    } catch (err) {
      console.error('Error fetching staffs', err);
    } finally {
      setLoading(false);
    }
  };

  const saveToSupabase = async (newExpenses: Record<string, ExpenseData>): Promise<{ success: boolean; error?: string }> => {
    if (!shopId || !startDate || !endDate) {
      return { success: false, error: 'Thiếu thông tin cửa hàng hoặc ngày' };
    }
    if (staffs.length === 0) {
      return { success: true };
    }

    const upsertData = staffs.map(staff => {
      const e = newExpenses[staff.id] || DEFAULT_EXPENSE;
      return {
        shop_id: shopId,
        staff_id: staff.id,
        period_start: startDate,
        period_end: endDate,
        salary: Number(e.salary) || 0,
        commission: Number(e.commission) || 0,
        bonus: Number(e.bonus) || 0,
        tip: Number(e.tip) || 0,
        bonus_tip: Number(e.bonusTip) || 0,
        overtime: Number(e.overtime) || 0,
        overtime_money: Number(e.overtimeMoney) || 0,
        bonus_overtime: Number(e.bonusOvertime) || 0,
        tour: Number(e.tour) || 0,
        bonus_tour: Number(e.bonusTour) || 0,
        meal: Number(e.meal) || 0,
        bonus_meal: Number(e.bonusMeal) || 0,
        kpi: Number(e.kpi) || 0,
        support: Number(e.support) || 0,
        updated_at: new Date().toISOString()
      };
    });
    
    try {
      // 1. Thử upsert chuẩn (không có khoảng trắng trong onConflict)
      const { error: upsertError } = await supabase.from('staff_expenses').upsert(upsertData, {
        onConflict: 'shop_id,staff_id,period_start,period_end'
      });
      
      if (!upsertError) {
        return { success: true };
      }

      console.warn("Upsert failed, trying delete + insert fallback:", upsertError);

      // 2. Fallback nếu DB thiếu ràng buộc unique hoặc xung đột:
      // Xoá bản ghi cũ trong khoảng thời gian này rồi insert lại
      const { error: delError } = await supabase
        .from('staff_expenses')
        .delete()
        .eq('shop_id', shopId)
        .eq('period_start', startDate)
        .eq('period_end', endDate);

      if (delError) {
        console.error("Fallback delete error:", delError);
        return { success: false, error: upsertError.message || delError.message };
      }

      const { error: insertError } = await supabase
        .from('staff_expenses')
        .insert(upsertData);

      if (insertError) {
        console.error("Fallback insert error:", insertError);
        return { success: false, error: insertError.message };
      }

      return { success: true };
    } catch (e: any) {
      console.error("Exception saving to supabase:", e);
      return { success: false, error: e?.message || 'Lỗi không xác định' };
    }
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveToSupabase(expenses);
      if (res.success) {
        alert('Đã đồng bộ toàn bộ dữ liệu lên Cloud thành công!');
      } else {
        alert('Lỗi khi lưu lên Cloud: ' + (res.error || 'Vui lòng kiểm tra lại'));
      }
    } catch (err: any) {
      alert('Lỗi kết nối khi lưu: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const loadSavedData = () => {
    if (!shopId || !startDate || !endDate || staffs.length === 0) return;
    const key = `staff_expenses_${shopId}_${startDate}_${endDate}`;
    const saved = localStorage.getItem(key);
    let parsedSaved: Record<string, ExpenseData> | null = null;
    if (saved) {
      try {
        parsedSaved = JSON.parse(saved);
        setExpenses(parsedSaved!);
      } catch (e) {
        console.error('Error parsing saved expenses', e);
      }
    }

    const fetchData = async () => {
      setDataLoading(true);
      try {
        const sdObj = new Date(`${startDate}T00:00:00`);
        const edObj = new Date(`${endDate}T23:59:59.999`);
        const startStr = sdObj.toISOString();
        const endStr = edObj.toISOString();

        // 0. Lấy dữ liệu đã lưu từ Cloud
        const { data: dbExpenses, error: dbError } = await supabase
          .from('staff_expenses')
          .select('*')
          .eq('shop_id', shopId)
          .eq('period_start', startDate)
          .eq('period_end', endDate);

        if (dbError) {
          console.error("Error fetching staff_expenses:", dbError);
        }

        const dbMap = new Map<string, any>();
        if (dbExpenses && dbExpenses.length > 0) {
          dbExpenses.forEach(e => dbMap.set(e.staff_id, e));
        }

        // Tự động đẩy dữ liệu từ localStorage lên Cloud nếu Cloud chưa có
        if (dbMap.size === 0 && parsedSaved && Object.keys(parsedSaved).length > 0) {
          saveToSupabase(parsedSaved);
        }

        // 1. Lấy hoa hồng từ commission_logs
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

        // 2. Lấy thu nhập KTV từ staff_daily_income
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

        // Hợp nhất dữ liệu: Ưu tiên Cloud (nếu đã lưu) -> LocalStorage -> Tính tự động từ Logs
        const next: Record<string, ExpenseData> = {};

        staffs.forEach(s => {
          const dbE = dbMap.get(s.id);
          const localE = parsedSaved?.[s.id];
          const newComm = commMap.get(s.id) || 0;
          const staffInc = incomeMap.get(s.full_name) || { tip: 0, tour: 0, overtime: 0, meal: 0 };
          const calcOvertimeMoney = Math.round((staffInc.overtime / 60) * 25000);

          if (dbE) {
            // Khi Cloud đã có dữ liệu, dùng 100% dữ liệu đã lưu trên Cloud (không bị Logs ghi đè)
            next[s.id] = {
              salary: Number(dbE.salary) || 0,
              commission: Number(dbE.commission) || 0,
              bonus: Number(dbE.bonus) || 0,
              tip: Number(dbE.tip) || 0,
              bonusTip: Number(dbE.bonus_tip) || 0,
              overtime: Number(dbE.overtime) || 0,
              overtimeMoney: Number(dbE.overtime_money) || 0,
              bonusOvertime: Number(dbE.bonus_overtime) || 0,
              tour: Number(dbE.tour) || 0,
              bonusTour: Number(dbE.bonus_tour) || 0,
              meal: Number(dbE.meal) || 0,
              bonusMeal: Number(dbE.bonus_meal) || 0,
              kpi: Number(dbE.kpi) || 0,
              support: Number(dbE.support) || 0
            };
          } else if (localE) {
            // Chưa có trên Cloud nhưng thiết bị có lưu local
            next[s.id] = {
              salary: Number(localE.salary) || 0,
              commission: localE.commission !== undefined ? Number(localE.commission) : newComm,
              bonus: Number(localE.bonus) || 0,
              tip: localE.tip !== undefined ? Number(localE.tip) : staffInc.tip,
              bonusTip: Number(localE.bonusTip) || 0,
              overtime: localE.overtime !== undefined ? Number(localE.overtime) : staffInc.overtime,
              overtimeMoney: localE.overtimeMoney !== undefined ? Number(localE.overtimeMoney) : calcOvertimeMoney,
              bonusOvertime: Number(localE.bonusOvertime) || 0,
              tour: localE.tour !== undefined ? Number(localE.tour) : staffInc.tour,
              bonusTour: Number(localE.bonusTour) || 0,
              meal: localE.meal !== undefined ? Number(localE.meal) : staffInc.meal,
              bonusMeal: Number(localE.bonusMeal) || 0,
              kpi: Number(localE.kpi) || 0,
              support: Number(localE.support) || 0
            };
          } else {
            // Mở lần đầu trên thiết bị mới (chưa có Cloud và Local): Khởi tạo tự động từ log hoa hồng & thu nhập
            next[s.id] = {
              ...DEFAULT_EXPENSE,
              commission: newComm,
              tip: staffInc.tip,
              tour: staffInc.tour,
              overtime: staffInc.overtime,
              overtimeMoney: calcOvertimeMoney,
              meal: staffInc.meal
            };
          }
        });

        setExpenses(next);
        localStorage.setItem(key, JSON.stringify(next));
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setDataLoading(false);
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

    // Debounce save to Supabase
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveToSupabase(newExpenses);
    }, 1500);
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
            Dữ liệu chi phí được đồng bộ Cloud theo khoảng thời gian giữa các thiết bị.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <button
            className="btn btn-primary"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#10b981', borderColor: '#10b981' }}
            onClick={handleManualSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="animate-spin" size={14} /> : <span>💾 Lưu Cloud</span>}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap', minHeight: 'auto' }}
            onClick={() => {
              const d = new Date();
              setStartDate(formatLocalDate(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
              setEndDate(formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 0)));
            }}
          >
            Tháng trước
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap', minHeight: 'auto' }}
            onClick={() => {
              const d = new Date();
              setStartDate(formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1)));
              setEndDate(formatLocalDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
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

      {loading || dataLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin text-primary" size={32} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Đang tải dữ liệu từ Cloud...</span>
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
                if (['commission', 'bonus'].includes(cat.key)) rowBg = 'rgba(236, 72, 153, 0.15)'; // pink
                if (['tip', 'bonusTip'].includes(cat.key)) rowBg = 'rgba(34, 197, 94, 0.15)'; // green
                if (['overtime', 'overtimeMoney', 'bonusOvertime'].includes(cat.key)) rowBg = 'rgba(234, 179, 8, 0.25)'; // yellow
                if (['tour', 'bonusTour'].includes(cat.key)) rowBg = 'rgba(59, 130, 246, 0.15)'; // blue
                if (['meal', 'bonusMeal'].includes(cat.key)) rowBg = 'rgba(249, 115, 22, 0.15)'; // orange
                
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
