import React from 'react';
import { createPortal } from 'react-dom';
import '../receipt.css';
import type { ShopPrintSettings } from '../lib/printSettings';

// Interface cho cấu hình in ấn (Có thể lấy từ bảng `shops` hoặc `print_configs` sau này)
export interface PrintConfig {
  logo_url?: string;
  shop_name: string;
  slogan?: string;
  address?: string;
  phone?: string;
  footer_message?: string;
  qr_payment_url?: string;
  paper_size?: '58mm' | '80mm';
}

interface ReceiptTemplateProps {
  invoice: any;
  config: PrintConfig;
  printSettings?: ShopPrintSettings;
  debugMode?: boolean;
  renderInline?: boolean; // Nếu true, không dùng createPortal
  containerRef?: React.Ref<HTMLDivElement>;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ 
  invoice, 
  config, 
  printSettings, 
  debugMode,
  renderInline,
  containerRef
}) => {
  if (!invoice) return null;

  const internalRef = React.useRef<HTMLDivElement>(null);
  const receiptRef = (containerRef as React.RefObject<HTMLDivElement>) || internalRef;

  React.useEffect(() => {
    const handleBeforePrint = () => {
      console.log('BEFORE PRINT', {
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        receiptRect: receiptRef.current?.getBoundingClientRect()
      });
    };
    
    const handleAfterPrint = () => {
      console.log('AFTER PRINT');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handleDebugPrintReport = async () => {
    let cssText = "Không thể đọc file CSS";
    try {
      const res = await fetch('/src/receipt.css');
      if (res.ok) cssText = await res.text();
    } catch (e) {}

    const el = receiptRef.current;
    const styles = el ? window.getComputedStyle(el) : null;

    const report = {
      receiptRect: {
        receiptWidth: el?.offsetWidth,
        receiptHeight: el?.offsetHeight,
        boundingRect: el?.getBoundingClientRect(),
        scrollTop: window.scrollY,
        scrollLeft: window.scrollX
      },
      styles: {
        position: styles?.position,
        top: styles?.top,
        left: styles?.left,
        marginTop: styles?.marginTop,
        marginBottom: styles?.marginBottom,
        marginLeft: styles?.marginLeft,
        marginRight: styles?.marginRight,
        paddingTop: styles?.paddingTop,
        paddingBottom: styles?.paddingBottom,
        transform: styles?.transform,
        display: styles?.display
      },
      body: {
        bodyScrollHeight: document.body.scrollHeight,
        bodyOffsetHeight: document.body.offsetHeight,
        bodyClientHeight: document.body.clientHeight
      },
      html: {
        htmlScrollHeight: document.documentElement.scrollHeight,
        htmlOffsetHeight: document.documentElement.offsetHeight,
        htmlClientHeight: document.documentElement.clientHeight
      },
      dom: {
        outerHTML: document.querySelector('.print-only')?.outerHTML
      },
      printSettings: {
        paper_size: printSettings?.paper_size || config.paper_size,
        top_offset: printSettings?.top_offset,
        left_offset: printSettings?.left_offset,
        scale_percent: printSettings?.scale_percent
      },
      receiptCss: cssText,
      receiptLocation: renderInline ? "Inline trong DOM" : "createPortal -> document.body",
      scroll: {
        scrollY: window.scrollY,
        scrollX: window.scrollX
      },
      printContainer: {
        bodyClass: document.body.className,
        htmlClass: document.documentElement.className
      }
    };

    console.log("=== DEBUG PRINT REPORT V2 ===");
    console.log(report);
    
    const jsonStr = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
      alert("Đã copy toàn bộ dữ liệu thành JSON! Hãy dán để gửi cho ChatGPT.");
    } catch (e) {
      console.log(jsonStr);
      alert("Copy thất bại do giới hạn trình duyệt. Vui lòng mở F12 (Console) để copy chuỗi JSON.");
    }
  };

  // Cấu hình kích thước giấy ưu tiên từ printSettings, nếu không có lấy từ config tĩnh
  const paperSize = printSettings?.paper_size || config.paper_size || '58mm';
  const paperWidth = paperSize === '58mm' ? '220px' : '300px';

  const customStyles: any = {
    '--receipt-width': paperWidth,
  };

  if (printSettings) {
    customStyles.top = `${printSettings.top_offset || 0}px`;
    customStyles.left = `${printSettings.left_offset || 0}px`;
    if (printSettings.scale_percent && printSettings.scale_percent !== 100) {
      customStyles.transform = `scale(${printSettings.scale_percent / 100})`;
      customStyles.transformOrigin = 'top left';
    }
  }

  if (debugMode) {
    customStyles.border = '2px dashed red';
  }

  const content = (
    <>
      {debugMode && (
        <div className="no-print" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 999999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={handleDebugPrintReport} 
            style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
          >
            DEBUG PRINT REPORT
          </button>
          <button 
            onClick={() => {
              alert("Vui lòng chọn 'Save as PDF' (Lưu dưới dạng PDF) trong hộp thoại in.\n\nSau khi lưu, hãy kiểm tra xem:\n1. Bản PDF có khoảng trắng không?\n2. Khi in ra máy in thật có khoảng trắng không?");
              window.print();
            }} 
            style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
          >
            SAVE PDF TEST
          </button>
        </div>
      )}
      <div 
        className={`print-only receipt-container ${renderInline ? 'inline-receipt' : ''}`} 
        style={customStyles}
        ref={receiptRef}
      >
        <div className="receipt-header">
          {config.logo_url && <img src={config.logo_url} alt="Logo" style={{ maxWidth: '80px', marginBottom: '10px' }} />}
          <h2>{config.shop_name}</h2>
          {config.slogan && <p style={{ fontStyle: 'italic' }}>{config.slogan}</p>}
          {config.address && <p>{config.address}</p>}
          {config.phone && <p>Hotline: {config.phone}</p>}
          
          <p style={{ marginTop: '15px', fontWeight: 'bold' }}>
            {invoice.is_use_package ? 'BIÊN NHẬN DÙNG LIỆU TRÌNH' : 'HOÁ ĐƠN THANH TOÁN'}
          </p>
        </div>
        
        <div className="receipt-section">
          <p>Mã: #{invoice.invoice_code || '---'}</p>
          <p>Khách: {invoice.customer_name}</p>
          {invoice.customer_phone && <p>SĐT: {invoice.customer_phone}</p>}
          {invoice.card_code && <p>Mã thẻ: {invoice.card_code}</p>}
          <p>Nhân viên: {invoice.staff_name}</p>
          <p>Ngày: {new Date(invoice.created_at || Date.now()).toLocaleString('vi-VN')}</p>
        </div>

        <div className="receipt-section">
          {invoice.items?.map((item: any, i: number) => (
            <div key={i} className="receipt-item">
              <span style={{ maxWidth: '60%' }}>{item.name}</span>
              <span>{item.price === '-' ? '-' : Number(item.price).toLocaleString()}</span>
            </div>
          ))}
        </div>
        
        {invoice.is_use_package ? (
          <div className="receipt-totals">
            <p>Tổng số buổi gói: {invoice.total_sessions}</p>
            <p>Đã dùng (Bao gồm lần này): {invoice.used_sessions}</p>
            <h3>CÒN LẠI: {invoice.total_sessions - invoice.used_sessions} buổi</h3>
          </div>
        ) : (
          <div className="receipt-totals">
            <p>Tạm tính: {Number(invoice.total_amount || 0).toLocaleString()}đ</p>
            <p>Giảm giá: {Number(invoice.discount_amount || 0).toLocaleString()}đ</p>
            <h3>TỔNG: {Number(invoice.final_amount || 0).toLocaleString()}đ</h3>
          </div>
        )}
        
        {config.qr_payment_url && (
          <div style={{ textAlign: 'center', marginTop: '20px', pageBreakInside: 'avoid' }}>
            <img src={config.qr_payment_url} alt="QR Code" style={{ width: '120px', height: '120px' }} />
            <p style={{ fontSize: '10px' }}>Quét mã để thanh toán</p>
          </div>
        )}

      </div>
    </>
  );

  if (renderInline) {
    return content;
  }

  return createPortal(content, document.body);
};
