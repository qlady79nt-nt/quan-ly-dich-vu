import React from 'react';
import '../receipt.css';

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
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ invoice, config }) => {
  if (!invoice) return null;

  // Cấu hình kích thước giấy
  const paperWidth = config.paper_size === '58mm' ? '220px' : '300px';

  return (
    <div className="print-only receipt-container" style={{ '--receipt-width': paperWidth } as any}>
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
        <p>Ngày: {new Date(invoice.created_at || Date.now()).toLocaleString()}</p>
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

      <div className="receipt-footer">
        <p>{config.footer_message || 'Cảm ơn quý khách! Hẹn gặp lại.'}</p>
      </div>
    </div>
  );
};
