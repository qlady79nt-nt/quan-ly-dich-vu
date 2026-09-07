use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use rust_xlsxwriter::{Workbook, Format, FormatBorder, FormatAlign};

pub const DEFAULT_POSA_DATA_DIR: &str = r"C:\Program Files\POSA\data";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PosaReportItem {
    pub date: String,
    pub technician: String,
    pub service: String,
    pub code: Option<String>,
    pub quantity: i32,
    pub unit_price: f64,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PosaReportPayload {
    pub date: String,             // Format: YYYY-MM-DD
    pub shop_name: Option<String>,
    pub items: Vec<PosaReportItem>,
}

/// Helper kiểm tra định dạng ngày YYYY-MM-DD nghiêm ngặt
pub fn is_valid_date_format(date: &str) -> bool {
    if date.len() != 10 {
        return false;
    }
    let bytes = date.as_bytes();
    if bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    bytes[0..4].iter().all(|b| b.is_ascii_digit())
        && bytes[5..7].iter().all(|b| b.is_ascii_digit())
        && bytes[8..10].iter().all(|b| b.is_ascii_digit())
}

/// Helper tạo đường dẫn file an toàn tuyệt đối
/// Chỉ cho phép: <base_dir>\DoanhThu_YYYY-MM-DD.xlsx
/// Tuyệt đối cấm path traversal (..), absolute path từ WebView, ký tự slash/backslash
pub fn get_safe_report_path(base_dir: &Path, date: &str) -> Result<PathBuf, String> {
    if !is_valid_date_format(date) {
        return Err(format!("Định dạng ngày không hợp lệ (yêu cầu YYYY-MM-DD): {}", date));
    }
    if date.contains('/') || date.contains('\\') || date.contains("..") {
        return Err("Phát hiện ký tự đường dẫn không hợp lệ (path traversal)".to_string());
    }
    let expected_filename = format!("DoanhThu_{}.xlsx", date);
    Ok(base_dir.join(expected_filename))
}

/// Core function ghi file Excel vào thư mục chỉ định
pub fn save_report_to_dir(base_dir: &Path, payload: PosaReportPayload) -> Result<PathBuf, String> {
    let date = &payload.date;
    let target_path = get_safe_report_path(base_dir, date)?;

    if !base_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(base_dir) {
            return Err(format!("Không thể tạo thư mục {:?}: {}", base_dir, e));
        }
    }

    // Khởi tạo Workbook Excel .xlsx native
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    // Định dạng Format
    let title_format = Format::new()
        .set_bold()
        .set_font_size(14)
        .set_align(FormatAlign::Center);
    let sub_format = Format::new()
        .set_font_size(10)
        .set_align(FormatAlign::Center);
    let header_format = Format::new()
        .set_bold()
        .set_font_size(11)
        .set_align(FormatAlign::Center)
        .set_border(FormatBorder::Thin);
    let cell_format = Format::new()
        .set_font_size(10)
        .set_border(FormatBorder::Thin);
    let num_format = Format::new()
        .set_font_size(10)
        .set_border(FormatBorder::Thin)
        .set_num_format("#,##0");
    let total_format = Format::new()
        .set_bold()
        .set_font_size(11)
        .set_border(FormatBorder::Thin)
        .set_num_format("#,##0");

    let shop_name = payload.shop_name.unwrap_or_else(|| "SPA".to_string());

    // Tiêu đề
    worksheet.merge_range(0, 0, 0, 7, &format!("BÁO CÁO DOANH THU - {}", shop_name.to_uppercase()), &title_format)
        .map_err(|e| e.to_string())?;
    worksheet.merge_range(1, 0, 1, 7, &format!("Ngày: {}", date), &sub_format)
        .map_err(|e| e.to_string())?;

    // Headers
    let headers = [
        "STT", "Ngày", "Kỹ thuật viên", "Dịch vụ / Sản phẩm", 
        "Mã phiếu / HĐ", "Số lượng", "Đơn giá (VNĐ)", "Thành tiền (VNĐ)"
    ];
    for (col, h) in headers.iter().enumerate() {
        worksheet.write_string_with_format(3, col as u16, *h, &header_format)
            .map_err(|e| e.to_string())?;
    }

    let mut row_idx = 4u32;
    let mut total_amount = 0.0;
    let mut total_qty = 0i32;

    for (idx, item) in payload.items.iter().enumerate() {
        worksheet.write_number_with_format(row_idx, 0, (idx + 1) as f64, &cell_format).map_err(|e| e.to_string())?;
        worksheet.write_string_with_format(row_idx, 1, &item.date, &cell_format).map_err(|e| e.to_string())?;
        worksheet.write_string_with_format(row_idx, 2, &item.technician, &cell_format).map_err(|e| e.to_string())?;
        worksheet.write_string_with_format(row_idx, 3, &item.service, &cell_format).map_err(|e| e.to_string())?;
        worksheet.write_string_with_format(row_idx, 4, item.code.as_deref().unwrap_or("---"), &cell_format).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(row_idx, 5, item.quantity as f64, &cell_format).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(row_idx, 6, item.unit_price, &num_format).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(row_idx, 7, item.amount, &num_format).map_err(|e| e.to_string())?;

        total_amount += item.amount;
        total_qty += item.quantity;
        row_idx += 1;
    }

    // Dòng tổng kết
    worksheet.merge_range(row_idx, 0, row_idx, 4, "TỔNG CỘNG", &header_format).map_err(|e| e.to_string())?;
    worksheet.write_number_with_format(row_idx, 5, total_qty as f64, &header_format).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(row_idx, 6, "", &header_format).map_err(|e| e.to_string())?;
    worksheet.write_number_with_format(row_idx, 7, total_amount, &total_format).map_err(|e| e.to_string())?;

    // Auto-fit column widths
    worksheet.autofit();

    workbook.save(&target_path).map_err(|e| format!("Lỗi khi lưu file {:?}: {}", target_path, e))?;

    Ok(target_path)
}

/// Core function quét danh sách file ngày trong thư mục
pub fn scan_existing_reports_in_dir(base_dir: &Path) -> Vec<String> {
    if !base_dir.exists() {
        return Vec::new();
    }

    let mut existing_dates = Vec::new();
    if let Ok(entries) = std::fs::read_dir(base_dir) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.starts_with("DoanhThu_") && file_name.ends_with(".xlsx") {
                    let date_part = file_name
                        .trim_start_matches("DoanhThu_")
                        .trim_end_matches(".xlsx");
                    if is_valid_date_format(date_part) {
                        existing_dates.push(date_part.to_string());
                    }
                }
            }
        }
    }
    existing_dates.sort();
    existing_dates
}

/// 1. TAURI COMMAND: Kiểm tra danh sách các ngày đã có file trong C:\Program Files\POSA\data
#[tauri::command]
pub fn check_existing_posa_reports() -> Result<Vec<String>, String> {
    Ok(scan_existing_reports_in_dir(Path::new(DEFAULT_POSA_DATA_DIR)))
}

/// 2. TAURI COMMAND: Lưu báo cáo doanh số ngày cũ vào C:\Program Files\POSA\data\DoanhThu_YYYY-MM-DD.xlsx
#[tauri::command]
pub fn save_posa_daily_report(payload: PosaReportPayload) -> Result<String, String> {
    let saved_path = save_report_to_dir(Path::new(DEFAULT_POSA_DATA_DIR), payload)?;
    Ok(format!("Đã lưu báo cáo thành công: {:?}", saved_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_date_validation() {
        assert!(is_valid_date_format("2026-09-07"));
        assert!(is_valid_date_format("2025-01-01"));
        assert!(!is_valid_date_format("2026-9-7"));
        assert!(!is_valid_date_format("2026/09/07"));
        assert!(!is_valid_date_format("../2026-09-07"));
        assert!(!is_valid_date_format(""));
        assert!(!is_valid_date_format("2026-09-07.xlsx"));
    }

    #[test]
    fn test_path_traversal_blocked() {
        let base = Path::new(r"C:\Program Files\POSA\data");
        assert!(get_safe_report_path(base, "../2026-09-07").is_err());
        assert!(get_safe_report_path(base, "2026/09/07").is_err());
        assert!(get_safe_report_path(base, r"..\..\test").is_err());
        assert!(get_safe_report_path(base, "C:\\evil.xlsx").is_err());
        
        let safe = get_safe_report_path(base, "2026-05-15").unwrap();
        assert_eq!(safe, PathBuf::from(r"C:\Program Files\POSA\data\DoanhThu_2026-05-15.xlsx"));
    }

    #[test]
    fn test_save_and_scan_real_xlsx() {
        let temp_dir = std::env::temp_dir().join(format!("posa_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
        let _ = fs::create_dir_all(&temp_dir);

        let payload = PosaReportPayload {
            date: "2026-05-20".to_string(),
            shop_name: Some("Spa Hoàng Gia".to_string()),
            items: vec![
                PosaReportItem {
                    date: "2026-05-20".to_string(),
                    technician: "KTV Nguyễn Thị Hoa".to_string(),
                    service: "Massage body đá nóng".to_string(),
                    code: Some("F-260520".to_string()),
                    quantity: 1,
                    unit_price: 450000.0,
                    amount: 450000.0,
                },
                PosaReportItem {
                    date: "2026-05-20".to_string(),
                    technician: "KTV Trần Thị Lan".to_string(),
                    service: "Gội đầu dưỡng sinh".to_string(),
                    code: Some("F-260520".to_string()),
                    quantity: 2,
                    unit_price: 250000.0,
                    amount: 500000.0,
                },
            ],
        };

        let result = save_report_to_dir(&temp_dir, payload);
        assert!(result.is_ok());
        let file_path = result.unwrap();
        assert!(file_path.exists());
        assert!(fs::metadata(&file_path).unwrap().len() > 1000); // Valid zip/xlsx file size

        let existing = scan_existing_reports_in_dir(&temp_dir);
        assert_eq!(existing, vec!["2026-05-20".to_string()]);

        // Dọn dẹp
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
