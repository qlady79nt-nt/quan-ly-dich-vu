import { supabase } from './supabase';

export interface FakeRevenueRecord {
  id: string;
  shop_id: string;
  revenue_date: string;
  staff_id: string | null;
  technician_name_snapshot: string;
  service_id: string | null;
  service_name_snapshot: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
}

export interface ShopFakeRevenueConfig {
  id?: string;
  shop_id: string;
  fake_start_date: string;
  base_config: Record<string, number>;
  variation_percent: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo giờ Việt Nam
 */
export const getTodayVNString = (): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

/**
 * Kiểm tra cấu hình doanh số ảo của Shop
 */
export const getShopFakeRevenueConfig = async (shopId: string): Promise<ShopFakeRevenueConfig | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_fake_revenue_configs')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle();

    if (error) {
      console.warn('Không thể tải shop_fake_revenue_configs:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Lỗi khi lấy config fake revenue:', err);
    return null;
  }
};

/**
 * Lưu/Cập nhật cấu hình doanh số ảo cho Shop (Dành riêng cho Super Admin)
 */
export const saveShopFakeRevenueConfig = async (
  shopId: string,
  fakeStartDate: string,
  baseConfig: Record<string, number>,
  variationPercent: number = 10
): Promise<{ success: boolean; error?: string }> => {
  try {
    const payload = {
      shop_id: shopId,
      fake_start_date: fakeStartDate,
      base_config: baseConfig,
      variation_percent: variationPercent,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('shop_fake_revenue_configs')
      .upsert(payload, { onConflict: 'shop_id' });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi không xác định' };
  }
};

/**
 * Gọi PostgreSQL RPC để lấy hoặc sinh Fake Revenue cho 1 ngày cụ thể.
 * Database/RPC là Single Source of Truth cho cả POSA Desktop và Web App.
 */
export const fetchFakeRevenueForDay = async (
  shopId: string,
  dateStr: string
): Promise<FakeRevenueRecord[]> => {
  const today = getTodayVNString();
  if (dateStr >= today) {
    return []; // Hôm nay dùng Real, tương lai = 0
  }

  try {
    const { data, error } = await supabase.rpc('sp_get_or_create_fake_revenue_day', {
      p_shop_id: shopId,
      p_revenue_date: dateStr
    });

    if (error) {
      console.error(`Lỗi RPC sp_get_or_create_fake_revenue_day ngày ${dateStr}:`, error);
      throw new Error(`RPC Error [sp_get_or_create_fake_revenue_day]: ${error.message || JSON.stringify(error)}`);
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      shop_id: r.shop_id,
      revenue_date: r.revenue_date,
      staff_id: r.staff_id,
      technician_name_snapshot: r.technician_name_snapshot || 'Kỹ thuật viên',
      service_id: r.service_id,
      service_name_snapshot: r.service_name_snapshot || 'Dịch vụ Spa',
      quantity: Number(r.quantity || 1),
      unit_price: Number(r.unit_price || 0),
      amount: Number(r.amount || 0),
      created_at: r.created_at
    }));
  } catch (err) {
    console.error(`Lỗi khi gọi RPC fake revenue ngày ${dateStr}:`, err);
    throw err;
  }
};

/**
 * Lấy toàn bộ danh sách ngày giữa startDate và endDate (inclusive)
 */
export const getDatesInRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

/**
 * Lấy toàn bộ bản ghi Fake History cho một khoảng ngày (tuần/tháng)
 * Đảm bảo các ngày quá khứ đều được gọi RPC để sinh và khóa cố định nếu chưa có.
 */
export const fetchFakeRevenueForRange = async (
  shopId: string,
  startDate: string,
  endDate: string
): Promise<FakeRevenueRecord[]> => {
  const today = getTodayVNString();
  const allDates = getDatesInRange(startDate, endDate);
  const pastDates = allDates.filter(d => d < today);

  if (pastDates.length === 0) {
    return [];
  }

  // Gọi RPC cho từng ngày quá khứ song song (Database RPC xử lý idempotency an toàn)
  const results = await Promise.all(
    pastDates.map(dateStr => fetchFakeRevenueForDay(shopId, dateStr))
  );

  const flatRecords: FakeRevenueRecord[] = [];
  results.forEach(dayRecords => {
    flatRecords.push(...dayRecords);
  });

  return flatRecords;
};
