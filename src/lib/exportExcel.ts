/**
 * Tiện ích Xuất Báo Cáo Doanh Thu sang file Excel/CSV chuẩn UTF-8
 * Tương thích Microsoft Excel Windows/Mac, không bị lỗi font Tiếng Việt
 */

export interface ExportReportItem {
  date: string;
  technician: string;
  service: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: string;
  code?: string;
}

export const exportReportToExcel = (
  items: ExportReportItem[],
  shopName: string,
  startDate: string,
  endDate: string
) => {
  if (!items || items.length === 0) {
    alert('Không có dữ liệu để xuất Excel trong khoảng thời gian này!');
    return;
  }

  const title = `BÁO CÁO DOANH THU - ${shopName || 'CỬA HÀNG'}`;
  const timeRange = `Thời gian: Từ ${startDate} đến ${endDate}`;
  const exportTime = `Thời điểm xuất: ${new Date().toLocaleString('vi-VN')}`;

  const headers = [
    'STT',
    'Ngày',
    'Kỹ thuật viên',
    'Dịch vụ / Sản phẩm',
    'Mã phiếu / HĐ',
    'Loại',
    'Số lượng',
    'Đơn giá (VNĐ)',
    'Thành tiền (VNĐ)'
  ];

  let totalAmount = 0;

  const rows = items.map((item, idx) => {
    totalAmount += Number(item.amount || 0);
    return [
      idx + 1,
      `"${item.date}"`,
      `"${(item.technician || '').replace(/"/g, '""')}"`,
      `"${(item.service || '').replace(/"/g, '""')}"`,
      `"${(item.code || '---').replace(/"/g, '""')}"`,
      `"${(item.type || '').replace(/"/g, '""')}"`,
      item.quantity || 1,
      Math.round(item.unitPrice || 0),
      Math.round(item.amount || 0)
    ].join(',');
  });

  // Dòng tổng kết
  const totalRow = [
    '',
    '"TỔNG CỘNG"',
    '',
    '',
    '',
    '',
    items.reduce((acc, it) => acc + (it.quantity || 1), 0),
    '',
    Math.round(totalAmount)
  ].join(',');

  // Ký tự BOM (\uFEFF) giúp Excel Windows nhận diện chuẩn mã UTF-8
  const csvContent = 
    '\uFEFF' +
    `"${title}"\n` +
    `"${timeRange}"\n` +
    `"${exportTime}"\n\n` +
    headers.join(',') + '\n' +
    rows.join('\n') + '\n' +
    totalRow;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const cleanShop = (shopName || 'Shop').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `BaoCao_DoanhThu_${cleanShop}_${startDate}_den_${endDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
