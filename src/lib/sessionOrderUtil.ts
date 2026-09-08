/**
 * Utility chuẩn hóa thứ tự cuốc dịch vụ (Service Sessions) cho Combo
 * Sử dụng `service_sessions.session_code` làm nguồn thứ tự chính.
 *
 * Cấu trúc mã session_code tạo từ POS:
 *   'S' + DD(2 ký tự) + MM(2 ký tự) + (100 + index)(3 ký tự: 100, 101, 102...) + random(3 ký tự)
 *   Ví dụ: S0809100912 -> index 0 (100), S0809101914 -> index 1 (101)
 */

export function parseSessionOrder(code: string | null | undefined): number {
  if (!code) return 999999;
  const str = String(code).trim();

  // 1. Combo session pattern từ POS: S + DD(2) + MM(2) + (100 + index)(3 ký tự: 100..199)
  const comboMatch = str.match(/^S\d{4}(1\d{2})/i);
  if (comboMatch) {
    return parseInt(comboMatch[1], 10);
  }

  // 2. Pattern có ký tự phân tách ở cuối: -1, _2, #3
  const sepMatch = str.match(/[-_#](\d+)$/);
  if (sepMatch) {
    return parseInt(sepMatch[1], 10);
  }

  // 3. Fallback: 3 chữ số bất kỳ sau tiền tố ngày (S + 4 số)
  const genericMatch = str.match(/^S\d{4}(\d{3})/i);
  if (genericMatch) {
    return parseInt(genericMatch[1], 10);
  }

  // 4. Fallback: các chữ số ở cuối chuỗi
  const trailingMatch = str.match(/(\d+)$/);
  if (trailingMatch) {
    return parseInt(trailingMatch[1], 10);
  }

  return 999999;
}

/**
 * Sắp xếp danh sách đối tượng có `session_code` theo thứ tự số tăng dần (1, 2, 3...)
 */
export function sortBySessionOrder<T extends { session_code?: string | null }>(items: T[]): T[] {
  if (!items || !Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const orderA = parseSessionOrder(a?.session_code);
    const orderB = parseSessionOrder(b?.session_code);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a?.session_code || '').localeCompare(String(b?.session_code || ''));
  });
}
