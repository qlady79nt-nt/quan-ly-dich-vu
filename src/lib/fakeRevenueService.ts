import { supabase } from './supabase';
import { getCloudTodayVN } from './cloudTimeService';

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
  base_config: Record<string, any>;
  variation_percent: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Lấy danh sách ID nhân viên được chọn từ cấu hình
 */
export const getSelectedStaffIdsFromConfig = (config: ShopFakeRevenueConfig | null): string[] => {
  if (!config || !config.base_config) return [];
  const raw = config.base_config.selected_staff_ids;
  if (Array.isArray(raw)) return raw;
  return [];
};

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo giờ Việt Nam từ Supabase Cloud Server
 */
export const getTodayVNString = (): string => {
  return getCloudTodayVN();
};

/**
 * Tạo mã phiếu/hóa đơn chuẩn theo định dạng thực tế trên POS:
 * #HD + [2 số Ngày] + [2 số Tháng] + [4 số ngẫu nhiên]
 * Ví dụ ngày 7 tháng 9: #HD07094722
 */
export const formatInvoiceCode = (dateStr?: string, seed?: string | number): string => {
  let dd = '01';
  let mm = '01';
  const effectiveDate = dateStr || getTodayVNString();
  if (effectiveDate.includes('-')) {
    const parts = effectiveDate.split('-');
    if (parts.length === 3) {
      mm = parts[1].padStart(2, '0');
      dd = parts[2].padStart(2, '0');
    }
  } else if (effectiveDate.includes('/')) {
    const parts = effectiveDate.split('/');
    if (parts.length === 3) {
      dd = parts[0].padStart(2, '0');
      mm = parts[1].padStart(2, '0');
    }
  }

  let rand4 = 1000;
  if (seed !== undefined && seed !== null) {
    let hash = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    rand4 = 1000 + (Math.abs(hash) % 9000);
  } else {
    rand4 = Math.floor(1000 + Math.random() * 9000);
  }

  return `#HD${dd}${mm}${rand4}`;
};

/**
 * Chuẩn hóa mã hóa đơn: đảm bảo luôn có tiền tố #HD và đúng định dạng
 * Định dạng: #HD + [2 số Ngày] + [2 số Tháng] + [4 số ngẫu nhiên] (ví dụ: #HD07094722)
 */
export const normalizeInvoiceCode = (rawCode?: string | null, dateStr?: string, seed?: string | number): string => {
  if (rawCode && rawCode !== '---') {
    const trimmed = rawCode.trim();
    // Nếu là mã cũ có dấu gạch ngang (ví dụ HD260907-01), tạo lại theo chuẩn mới
    if (trimmed.includes('-')) {
      return formatInvoiceCode(dateStr, seed || trimmed);
    }
    if (trimmed.startsWith('#HD')) return trimmed;
    if (trimmed.startsWith('HD')) return `#${trimmed}`;
    if (trimmed.startsWith('#')) return trimmed;
    return `#${trimmed}`;
  }
  return formatInvoiceCode(dateStr, seed);
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
 * Lưu/Cập nhật cấu hình doanh số ảo và danh sách nhân viên được chọn cho Shop
 */
export const saveShopFakeRevenueConfig = async (
  shopId: string,
  fakeStartDate: string,
  baseConfig: Record<string, number>,
  variationPercent: number = 10,
  selectedStaffIds: string[] = []
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Đóng gói mảng selected_staff_ids cùng với 31 ngày vào base_config JSONB
    const mergedBaseConfig: Record<string, any> = {
      ...baseConfig,
      selected_staff_ids: selectedStaffIds
    };

    const payload = {
      shop_id: shopId,
      fake_start_date: fakeStartDate,
      base_config: mergedBaseConfig,
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
