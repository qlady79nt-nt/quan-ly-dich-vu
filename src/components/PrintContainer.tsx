import React, { useEffect, useState } from 'react';

interface PrintContainerProps {
  children: React.ReactNode;
  onPrinted?: () => void;
}

/**
 * PrintContainer: Đảm bảo component con được render hoàn toàn vào DOM (display: block)
 * nhưng bị ẩn khỏi người dùng (opacity: 0, zIndex: -9999) để trình duyệt có thể
 * tính toán layout và font chính xác TRƯỚC KHI gọi window.print().
 * Giúp khắc phục lỗi lệch lề, dư khoảng trắng do `display: none` bị ép render đột ngột.
 */
export const PrintContainer: React.FC<PrintContainerProps> = ({ children, onPrinted }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Đợi 1 frame để DOM render xong hoàn toàn
    const timer1 = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer1);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    // Sau khi đã ready và hiển thị trên màn hình (dù opacity = 0), gọi print
    const timer2 = setTimeout(() => {
      window.scrollTo(0, 0);
      window.print();
    }, 300);

    const cleanup = () => {
      onPrinted?.();
    };

    window.addEventListener('afterprint', cleanup);

    return () => {
      clearTimeout(timer2);
      window.removeEventListener('afterprint', cleanup);
    };
  }, [isReady, onPrinted]);

  return (
    <div 
      className="print-container-wrapper"
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        opacity: 0, 
        pointerEvents: 'none', 
        zIndex: -9999,
        // Đảm bảo không tạo scrollbar trên web
        overflow: 'hidden',
        height: 0
      }}
    >
      <div style={{ position: 'relative', height: 'auto', overflow: 'visible' }}>
        {children}
      </div>
    </div>
  );
};
