import { isPosaDesktop } from './posaZoom';
import { 
  getTodayVNString, 
  getShopFakeRevenueConfig, 
  fetchFakeRevenueForDay, 
  getDatesInRange 
} from './fakeRevenueService';

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
 * Tính ngày hôm qua theo GMT+7
 */
export const getYesterdayVNString = (): string => {
  const todayStr = getTodayVNString();
  const [y, m, d] = todayStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const prevY = dt.getFullYear();
  const prevM = String(dt.getMonth() + 1).padStart(2, '0');
  const prevD = String(dt.getDate()).padStart(2, '0');
  return `${prevY}-${prevM}-${prevD}`;
};

/**
 * Service đồng bộ nền và Catch-up Excel cho POSA Desktop
 * 
 * Nguyên tắc vàng:
 * 1. TUYỆT ĐỐI KHÔNG tự động sinh Excel cho ngày hiện tại (Today) hoặc tương lai.
 * 2. Tự động kiểm tra thư mục C:\Program Files\POSA\data và bù các file ngày cũ còn thiếu.
 * 3. File ngày cũ lấy 100% dữ liệu từ fake_revenue_records đã khóa trong Database (thông qua RPC).
 * 4. Xử lý lỗi (ví dụ permission denied) an toàn, không làm crash ứng dụng.
 */
export const syncMissingPastPosaReports = async (
  shopId: string, 
  shopName: string = 'SPA'
): Promise<{ checked: number; generated: string[]; errors: string[] }> => {
  const result = { checked: 0, generated: [] as string[], errors: [] as string[] };

  // Guard: Chỉ chạy trên POSA Desktop và có native bridge
  if (!isPosaDesktop() || !window.__posa_native?.checkExistingReports || !window.__posa_native?.saveDailyReport) {
    return result;
  }

  try {
    const todayStr = getTodayVNString();
    const yesterdayStr = getYesterdayVNString();

    // Lấy cấu hình ngày bắt đầu ảo của Shop (do Super Admin cấu hình)
    const config = await getShopFakeRevenueConfig(shopId);
    const startDate = config?.fake_start_date;

    // Yêu cầu nghiệp vụ: Nếu shop chưa cấu hình fake_start_date -> TUYỆT ĐỐI KHÔNG auto-generate
    if (!startDate) {
      console.info('[POSA AutoSync] Shop chưa được Super Admin cấu hình fake_start_date. Bỏ qua tự động sinh báo cáo để tránh tạo dữ liệu ngoài ý muốn.');
      return result;
    }

    if (startDate > yesterdayStr) {
      // Chưa có ngày cũ nào cần sinh
      return result;
    }

    // Danh sách toàn bộ ngày quá khứ cần có file
    const targetDates = getDatesInRange(startDate, yesterdayStr).filter(d => d < todayStr);
    result.checked = targetDates.length;

    if (targetDates.length === 0) {
      return result;
    }

    // Quét các file đã có trong C:\Program Files\POSA\data qua Tauri Command
    let existingDates: string[] = [];
    try {
      existingDates = await window.__posa_native.checkExistingReports();
    } catch (scanErr: any) {
      console.warn('[POSA AutoSync] Lỗi khi quét danh sách file hiện có:', scanErr);
      result.errors.push(`Lỗi scan: ${scanErr.message || scanErr}`);
      return result;
    }

    // Lọc các ngày cũ còn thiếu file
    const missingDates = targetDates.filter(d => !existingDates.includes(d) && d < todayStr);

    if (missingDates.length === 0) {
      console.info('[POSA AutoSync] Tất cả các ngày cũ đều đã có file báo cáo đầy đủ.');
      return result;
    }

    console.info(`[POSA AutoSync] Phát hiện ${missingDates.length} ngày cũ thiếu file Excel. Đang tiến hành bù tự động...`, missingDates);

    // Đồng bộ tuần tự từng ngày
    for (const dateStr of missingDates) {
      // Guard nghiêm ngặt tuyệt đối không sinh cho today hoặc future
      if (dateStr >= todayStr) {
        continue;
      }

      try {
        // 1. Gọi RPC để lấy hoặc sinh Fake Revenue đã khóa
        const records = await fetchFakeRevenueForDay(shopId, dateStr);

        // 2. Định dạng payload gửi sang Tauri Rust native writer
        const invoiceCode = 'F-' + dateStr.replace(/-/g, '').slice(2);
        const payload: PosaNativeReportPayload = {
          date: dateStr,
          shop_name: shopName,
          items: records.map(r => ({
            date: r.revenue_date,
            technician: r.technician_name_snapshot || 'Kỹ thuật viên',
            service: r.service_name_snapshot || 'Dịch vụ',
            code: invoiceCode,
            quantity: r.quantity || 1,
            unit_price: Number(r.unit_price || 0),
            amount: Number(r.amount || 0)
          }))
        };

        // 3. Gọi Tauri command lưu file XLSX chuẩn
        const saveRes = await window.__posa_native.saveDailyReport(payload);
        result.generated.push(dateStr);
        console.info(`[POSA AutoSync] Đã sinh file ngày ${dateStr}:`, saveRes);
      } catch (dayErr: any) {
        const msg = dayErr?.message || String(dayErr);
        console.error(`[POSA AutoSync] Lỗi khi sinh file ngày ${dateStr}:`, msg);
        result.errors.push(`${dateStr}: ${msg}`);
        // Nếu lỗi do quyền truy cập thư mục C:\Program Files\POSA\data (Access Denied), dừng để tránh spam log
        if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('quyền')) {
          console.warn('[POSA AutoSync] Quyền ghi thư mục bị từ chối. Dừng các ngày tiếp theo.');
          break;
        }
      }
    }

    return result;
  } catch (err: any) {
    console.error('[POSA AutoSync] Ngoại lệ không xác định:', err);
    result.errors.push(err.message || String(err));
    return result;
  }
};

/**
 * Khởi chạy background sync và hẹn giờ kiểm tra khi qua nửa đêm (00:01 AM)
 */
export const initPosaAutoSync = (
  shopId: string, 
  shopName: string = 'SPA'
): (() => void) => {
  if (!isPosaDesktop() || !shopId) {
    return () => {};
  }

  let isRunning = false;

  const triggerSync = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await syncMissingPastPosaReports(shopId, shopName);
    } finally {
      isRunning = false;
    }
  };

  // 1. Chạy ngay khi mở ứng dụng (catch-up các ngày còn thiếu do máy tắt)
  const initialTimer = setTimeout(() => {
    triggerSync();
  }, 2500); // Đợi 2.5s để UI và Supabase auth sẵn sàng

  // 2. Chạy định kỳ mỗi 15 phút để đảm bảo nếu máy mở qua đêm sẽ tự bù ngày vừa kết thúc
  const intervalId = setInterval(() => {
    triggerSync();
  }, 15 * 60 * 1000);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(intervalId);
  };
};
