export const getShopCodeFromSubdomain = (): string | null => {
  const hostname = window.location.hostname;
  
  // Tránh lỗi khi chạy local (localhost) hoặc IP
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;

  // Domain chính của hệ thống
  const baseDomain = 'posspa.dichvupro.net';

  // Nếu truy cập trực tiếp base domain -> null
  if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
    return null;
  }

  // Nếu là subdomain (vd: spa-y9gp68.posspa.dichvupro.net)
  if (hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.replace(`.${baseDomain}`, '');
    // Subdomain chính là shop_code
    return subdomain;
  }

  // Trường hợp dùng custom domain hoặc dev preview Vercel (fallback an toàn)
  return null;
};
