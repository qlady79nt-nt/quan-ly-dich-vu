import { supabase } from './supabase';

/**
 * ====================================================================
 * CLOUD TIME SERVICE CHO POSA
 * Single Source of Truth cho toàn bộ Business Date (Asia/Ho_Chi_Minh, UTC+7)
 * ====================================================================
 * 
 * Nguyên tắc vàng:
 * 1. Supabase Cloud Server là nguồn thời gian nghiệp vụ duy nhất.
 * 2. Dùng performance.now() (Monotonic Clock của CPU) làm anchor tính elapsed time.
 *    -> Miễn nhiễm 100% khi người dùng chỉnh giờ, đổi ngày, đổi timezone trên Windows.
 * 3. Nếu chưa đồng bộ được giờ Cloud (mất mạng):
 *    -> isCloudTimeReady = false, KHÔNG tự động fallback âm thầm sang giờ Windows.
 * 4. Hỗ trợ tự động chuyển ngày qua nửa đêm (23:59 -> 00:00).
 */

interface CloudTimeState {
  isReady: boolean;
  serverAnchorUtcMs: number;
  perfAnchorMs: number;
  lastSyncAt: number;
}

const state: CloudTimeState = {
  isReady: false,
  serverAnchorUtcMs: 0,
  perfAnchorMs: 0,
  lastSyncAt: 0
};

let syncPromise: Promise<boolean> | null = null;

/**
 * Khởi tạo hoặc cập nhật mốc thời gian chuẩn từ Supabase Cloud
 * Gọi qua RPC public.sp_get_server_time()
 */
export const initCloudTimeSync = async (force: boolean = false): Promise<boolean> => {
  // Tránh gọi trùng lặp song song
  if (syncPromise) {
    return syncPromise;
  }

  // Nếu đã sync trong vòng 5 phút và không ép buộc thì tái sử dụng anchor
  if (!force && state.isReady && (performance.now() - state.perfAnchorMs < 5 * 60 * 1000)) {
    return true;
  }

  syncPromise = (async () => {
    try {
      const perfStart = performance.now();
      const { data, error } = await supabase.rpc('sp_get_server_time');

      if (error) {
        console.warn('[CloudTime] Chưa thể lấy giờ server qua RPC sp_get_server_time:', error.message);
        // Không fallback sang giờ Windows
        return state.isReady;
      }

      if (data && data.server_time_utc) {
        const serverUtcMs = Date.parse(data.server_time_utc);
        const perfEnd = performance.now();
        // Bù trừ một nửa latency network (ước tính trung bình)
        const roundTripHalf = (perfEnd - perfStart) / 2;

        state.serverAnchorUtcMs = serverUtcMs + roundTripHalf;
        state.perfAnchorMs = perfEnd;
        state.isReady = true;
        state.lastSyncAt = Date.now();

        console.info(`[CloudTime] Đồng bộ thành công Cloud Time: ${data.server_date_vn} (${data.timezone})`);
        return true;
      }

      return state.isReady;
    } catch (err) {
      console.error('[CloudTime] Ngoại lệ khi sync Cloud Time:', err);
      return state.isReady;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
};

/**
 * Kiểm tra xem Cloud Time đã sẵn sàng hay chưa
 */
export const isCloudTimeReady = (): boolean => {
  return state.isReady;
};

/**
 * Lấy mốc thời gian hiện tại (Date) theo giờ Việt Nam (UTC+7) dựa trên Cloud Time
 * Nếu chưa sync thành công, ném lỗi để ngăn chặn dùng sai giờ nghiệp vụ
 */
export const getCloudNowVN = (): Date => {
  if (!state.isReady) {
    throw new Error('Chưa thể xác định ngày chuẩn từ máy chủ Cloud. Vui lòng kết nối Internet.');
  }

  const elapsedMs = performance.now() - state.perfAnchorMs;
  const currentServerUtcMs = state.serverAnchorUtcMs + elapsedMs;
  // Bù +7 tiếng sang giờ Việt Nam (UTC+7)
  const vnMs = currentServerUtcMs + 7 * 60 * 60 * 1000;
  return new Date(vnMs);
};

/**
 * Lấy chuỗi ngày hôm nay YYYY-MM-DD theo giờ Việt Nam từ Cloud Server
 * Tự động chuyển ngày khi qua 00:00 nửa đêm nhờ monotonic elapsed time
 */
export const getCloudTodayVN = (): string => {
  const vnDate = getCloudNowVN();
  const y = vnDate.getUTCFullYear();
  const m = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vnDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Lấy chuỗi ngày hôm qua YYYY-MM-DD theo giờ Việt Nam từ Cloud Server
 */
export const getCloudYesterdayVN = (): string => {
  const todayStr = getCloudTodayVN();
  const [y, m, d] = todayStr.split('-').map(Number);
  const prevDate = new Date(Date.UTC(y, m - 1, d - 1));
  const py = prevDate.getUTCFullYear();
  const pm = String(prevDate.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(prevDate.getUTCDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}`;
};

/**
 * Chuyển đổi chuẩn xác 1 ngày Việt Nam YYYY-MM-DD sang khoảng thời gian UTC [startUTC, endUTC]
 * Cố định UTC+7, hoàn toàn không phụ thuộc vào múi giờ của máy trạm Windows!
 * 
 * Ví dụ ngày 2026-09-08:
 * - 00:00:00 VN = 2026-09-07T17:00:00.000Z
 * - 23:59:59.999 VN = 2026-09-08T16:59:59.999Z
 */
export const getVNDayUTCRange = (dateStr: string): { startUTC: string; endUTC: string } => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const prevDate = new Date(Date.UTC(y, m - 1, d - 1));
  const py = prevDate.getUTCFullYear();
  const pm = String(prevDate.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(prevDate.getUTCDate()).padStart(2, '0');

  return {
    startUTC: `${py}-${pm}-${pd}T17:00:00.000Z`,
    endUTC: `${dateStr}T16:59:59.999Z`
  };
};

// Tự động lắng nghe sự kiện online để refresh mốc thời gian ngay khi có mạng trở lại
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('[CloudTime] Phát hiện mạng đã kết nối lại. Tự động đồng bộ lại giờ Cloud...');
    initCloudTimeSync(true).catch(console.error);
  });
}
