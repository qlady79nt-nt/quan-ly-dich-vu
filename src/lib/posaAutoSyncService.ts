import { isPosaDesktop } from './posaZoom';
import { 
  getShopFakeRevenueConfig, 
  fetchFakeRevenueForDay, 
  getDatesInRange,
  formatInvoiceCode
} from './fakeRevenueService';
import {
  getCloudTodayVN,
  getCloudYesterdayVN,
  getVNDayUTCRange,
  isCloudTimeReady,
  initCloudTimeSync
} from './cloudTimeService';
import { supabase } from './supabase';
import { enrichRealRevenueLogs } from './realRevenueEnrichment';

export interface PosaNativeReportItem {
  date: string;
  technician: string;
  service: string;
  code?: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface PosaNativeReportPayload {
  date: string; // YYYY-MM-DD
  shop_name?: string;
  items: PosaNativeReportItem[];
}

declare global {
  interface Window {
    __posa_native?: {
      checkExistingReports: () => Promise<string[]>;
      saveDailyReport: (payload: PosaNativeReportPayload) => Promise<string>;
    };
  }
}

/**
 * Tính ngày hôm qua theo GMT+7 từ Cloud Server
 */
export const getYesterdayVNString = (): string => {
  return getCloudYesterdayVN();
};

const SYNCED_REPORTS_STORAGE_KEY = 'posa_synced_reports_v1_';

export const getSyncedDates = (shopId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`${SYNCED_REPORTS_STORAGE_KEY}${shopId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch (e) {
    console.warn('[POSA AutoSync] Không thể đọc danh sách ngày đã đồng bộ từ localStorage:', e);
  }
  return new Set<string>();
};

export const markDateAsSynced = (shopId: string, dateStr: string): void => {
  try {
    const set = getSyncedDates(shopId);
    set.add(dateStr);
    localStorage.setItem(
      `${SYNCED_REPORTS_STORAGE_KEY}${shopId}`,
      JSON.stringify(Array.from(set))
    );
  } catch (e) {
    console.warn('[POSA AutoSync] Không thể lưu danh sách ngày đã đồng bộ vào localStorage:', e);
  }
};



/**
 * Tái sinh các file báo cáo Excel còn thiếu trên máy POSA Desktop.
 *
 * NGUYÊN TẮC VÀNG:
 * 1. TUYỆT ĐỐI KHÔNG GHI ĐÈ BẤT KỲ FILE NÀO ĐÃ CÓ TRÊN ĐĨA.
 * 2. CHỈ sinh các file bị thiếu:
 *    - Quá khứ: lấy từ dữ liệu ảo đã khóa (fake_revenue_records).
 *    - Hôm nay: lấy từ dữ liệu doanh thu thật (revenue_logs) đã làm giàu đầy đủ KTV + Dịch vụ + Mã HĐ.
 * 3. Tuyệt đối không tạo file rỗng 0 rows.
 */
export const recreateMissingPosaReports = async (
  shopId: string,
  shopName: string = 'SPA'
): Promise<{ checked: number; generated: string[]; skipped: string[]; errors: string[] }> => {
  const result = { checked: 0, generated: [] as string[], skipped: [] as string[], errors: [] as string[] };

  // 1. Kiểm tra môi trường POSA Native Desktop
  if (!isPosaDesktop() || !window.__posa_native?.checkExistingReports || !window.__posa_native?.saveDailyReport) {
    console.info('[POSA Recreate] Không phải POSA Desktop hoặc thiếu Native API. Bỏ qua.');
    return result;
  }

  try {
    // Đảm bảo đồng bộ mốc thời gian Cloud trước khi tái sinh
    if (!isCloudTimeReady()) {
      await initCloudTimeSync();
    }
    if (!isCloudTimeReady()) {
      const errOffline = 'Chưa thể xác định ngày chuẩn từ máy chủ Cloud. Vui lòng kết nối Internet.';
      console.warn('[POSA Recreate]', errOffline);
      result.errors.push(errOffline);
      return result;
    }

    const todayStr = getCloudTodayVN();
    const yesterdayStr = getCloudYesterdayVN();

    // 2. Quét các file ĐANG TỒN TẠI trên đĩa
    let existingDates: string[] = [];
    try {
      existingDates = await window.__posa_native.checkExistingReports();
    } catch (scanErr: any) {
      console.warn('[POSA Recreate] Lỗi khi quét danh sách file hiện có:', scanErr);
      result.errors.push(`Lỗi scan: ${scanErr.message || scanErr}`);
      return result;
    }

    const config = await getShopFakeRevenueConfig(shopId);
    const startDate = config?.fake_start_date;

    // A. Xử lý các ngày quá khứ (startDate -> yesterdayStr)
    if (startDate && startDate <= yesterdayStr) {
      const pastDates = getDatesInRange(startDate, yesterdayStr).filter(d => d < todayStr);
      result.checked += pastDates.length;

      for (const d of pastDates) {
        // TUYỆT ĐỐI KHÔNG GHI ĐÈ FILE ĐANG CÓ
        if (existingDates.includes(d)) {
          console.info(`[POSA Recreate] File ngày ${d} đã tồn tại -> BỎ QUA, KHÔNG GHI ĐÈ.`);
          result.skipped.push(d);
          continue;
        }

        // Tái sinh ngày thiếu từ fake_revenue_records đã khóa
        try {
          const records = await fetchFakeRevenueForDay(shopId, d);
          if (!records || records.length === 0) {
            console.warn(`[POSA Recreate] Bỏ qua ngày ${d}: Không có bản ghi doanh thu hợp lệ từ DB.`);
            continue;
          }

          const payload: PosaNativeReportPayload = {
            date: d,
            shop_name: shopName,
            items: records.map((r, idx) => ({
              date: r.revenue_date,
              technician: r.technician_name_snapshot || 'Kỹ thuật viên',
              service: r.service_name_snapshot || 'Dịch vụ',
              code: formatInvoiceCode(r.revenue_date, r.id || `${d}_${idx}`),
              quantity: r.quantity || 1,
              unit_price: Number(r.unit_price || 0),
              amount: Number(r.amount || 0)
            }))
          };

          const saveRes = await window.__posa_native.saveDailyReport(payload);
          result.generated.push(d);
          markDateAsSynced(shopId, d);
          console.info(`[POSA Recreate] Đã tái sinh file ngày ${d} thành công (${records.length} dòng):`, saveRes);
        } catch (dayErr: any) {
          const msg = dayErr?.message || String(dayErr);
          console.error(`[POSA Recreate] Lỗi tái sinh ngày ${d}:`, msg);
          result.errors.push(`${d}: ${msg}`);
          if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('quyền')) {
            console.warn('[POSA Recreate] Quyền ghi thư mục bị từ chối. Dừng các ngày tiếp theo.');
            break;
          }
        }
      }
    }

    // B. Xử lý ngày hôm nay (todayStr)
    result.checked += 1;
    if (existingDates.includes(todayStr)) {
      console.info(`[POSA Recreate] File ngày hôm nay ${todayStr} đã tồn tại -> BỎ QUA, KHÔNG GHI ĐÈ.`);
      result.skipped.push(todayStr);
    } else {
      // Tái sinh ngày hôm nay từ revenue_logs thật
      try {
        const { startUTC, endUTC } = getVNDayUTCRange(todayStr);

        const { data: rawLogs, error: logsErr } = await supabase
          .from('revenue_logs')
          .select('*')
          .eq('shop_id', shopId)
          .gte('recorded_at', startUTC)
          .lte('recorded_at', endUTC)
          .neq('status', 'cancelled')
          .order('recorded_at', { ascending: false });

        if (logsErr) {
          console.error(`[POSA Recreate] Lỗi truy vấn revenue_logs hôm nay (${todayStr}):`, logsErr);
          result.errors.push(`${todayStr}: ${logsErr.message}`);
        } else if (rawLogs && rawLogs.length > 0) {
          const enrichedLogs = await enrichRealRevenueLogs(rawLogs);
          const enrichedItems: PosaNativeReportItem[] = enrichedLogs.map((r, idx) => ({
            date: todayStr,
            technician: r.technician_name || '---',
            service: r.service_name || 'Dịch vụ lẻ',
            code: r.code || formatInvoiceCode(todayStr, r.id || `${todayStr}_${idx}`),
            quantity: 1,
            unit_price: Number(r.amount || 0),
            amount: Number(r.amount || 0)
          }));

          const payload: PosaNativeReportPayload = {
            date: todayStr,
            shop_name: shopName,
            items: enrichedItems
          };

          const saveRes = await window.__posa_native.saveDailyReport(payload);
          result.generated.push(todayStr);
          console.info(`[POSA Recreate] Đã tái sinh file hôm nay ${todayStr} thành công (${enrichedItems.length} dòng doanh thu thật):`, saveRes);
        } else {
          console.info(`[POSA Recreate] Ngày hôm nay (${todayStr}) chưa có bản ghi doanh thu thật nào. Bỏ qua, không tạo file rỗng.`);
        }
      } catch (todayErr: any) {
        const msg = todayErr?.message || String(todayErr);
        console.error(`[POSA Recreate] Lỗi tái sinh ngày hôm nay ${todayStr}:`, msg);
        result.errors.push(`${todayStr}: ${msg}`);
      }
    }

    return result;
  } catch (err: any) {
    console.error('[POSA Recreate] Ngoại lệ không xác định:', err);
    result.errors.push(err.message || String(err));
    return result;
  }
};

/**
 * Wrapper tương thích ngược cho syncMissingPastPosaReports
 */
export const syncMissingPastPosaReports = async (
  shopId: string, 
  shopName: string = 'SPA',
  _forceResync: boolean = false
): Promise<{ checked: number; generated: string[]; errors: string[] }> => {
  const res = await recreateMissingPosaReports(shopId, shopName);
  return {
    checked: res.checked,
    generated: res.generated,
    errors: res.errors
  };
};

/**
 * Khởi chạy AutoSync: ĐÃ VÔ HIỆU HÓA HOÀN TOÀN TỰ ĐỘNG SINH FILE
 * Hệ thống tuân thủ nghiêm ngặt: Tuyệt đối không tự sinh file khi mở app hoặc định kỳ.
 * File chỉ được phép tái sinh khi người dùng nhấn 3 lần liên tục vào tab "Báo cáo".
 */
export const initPosaAutoSync = (
  _shopId: string,
  _shopName: string = 'SPA'
): (() => void) => {
  return () => {};
};
