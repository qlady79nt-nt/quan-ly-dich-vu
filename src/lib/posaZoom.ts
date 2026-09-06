const POSA_ZOOM_KEY = 'posa_zoom_level';

/**
 * Kiểm tra môi trường có phải POSA Desktop (Tauri / WebView2) hay không.
 * Tuyệt đối không kích hoạt trên Web App (Chrome/Edge/Firefox) hay Mobile.
 */
export const isPosaDesktop = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
};

/**
 * Khởi tạo Global Zoom cho POSA Desktop:
 * - Mức zoom: 1.0 (100%), 0.9 (90%), 0.8 (80%)
 * - Phím tắt: Ctrl + / Ctrl =, Ctrl - / Ctrl _, Ctrl 0
 * - Lưu và khôi phục tự động qua localStorage
 * - Không can thiệp các phím tắt khác (Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+Z, Ctrl+F)
 */
export const initPosaZoom = (): (() => void) => {
  if (!isPosaDesktop()) {
    return () => {};
  }

  // Guard tránh khởi tạo lặp lại
  if ((window as any).__posa_zoom_initialized) {
    return () => {};
  }
  (window as any).__posa_zoom_initialized = true;

  // 1. Khôi phục zoom đã lưu từ localStorage
  const saved = localStorage.getItem(POSA_ZOOM_KEY);
  let currentZoom = saved ? parseFloat(saved) : 1.0;
  if (isNaN(currentZoom) || currentZoom < 0.8 || currentZoom > 1.0) {
    currentZoom = 1.0;
  }
  document.documentElement.style.zoom = `${currentZoom}`;

  // 2. Lắng nghe phím tắt điều khiển zoom
  const handleKeyDown = (e: KeyboardEvent) => {
    // Chỉ kích hoạt khi có Ctrl (Windows) hoặc Cmd (Mac)
    if (!e.ctrlKey && !e.metaKey) return;

    // Zoom In: Ctrl + hoặc Ctrl =
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      const next = Math.min(1.0, Math.round((currentZoom + 0.1) * 10) / 10);
      if (next !== currentZoom) {
        currentZoom = next;
        document.documentElement.style.zoom = `${currentZoom}`;
        localStorage.setItem(POSA_ZOOM_KEY, `${currentZoom}`);
      }
    }
    // Zoom Out: Ctrl - hoặc Ctrl _
    else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      const next = Math.max(0.8, Math.round((currentZoom - 0.1) * 10) / 10);
      if (next !== currentZoom) {
        currentZoom = next;
        document.documentElement.style.zoom = `${currentZoom}`;
        localStorage.setItem(POSA_ZOOM_KEY, `${currentZoom}`);
      }
    }
    // Reset về 100%: Ctrl 0
    else if (e.key === '0') {
      e.preventDefault();
      if (currentZoom !== 1.0) {
        currentZoom = 1.0;
        document.documentElement.style.zoom = '1';
        localStorage.setItem(POSA_ZOOM_KEY, '1');
      }
    }
    // TUYỆT ĐỐI KHÔNG can thiệp Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+Z, Ctrl+F
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    delete (window as any).__posa_zoom_initialized;
  };
};
