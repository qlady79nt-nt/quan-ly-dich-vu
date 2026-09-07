; ====================================================================
; POSA DESKTOP - NSIS INSTALLER HOOKS
; Cấu hình phân quyền tối thiểu (Least Privilege) cho thư mục data
; ====================================================================

!macro NSIS_HOOK_POSTINSTALL
  ; 1. Tạo thư mục data con bên trong thư mục cài đặt ($INSTDIR\data) nếu chưa tồn tại
  CreateDirectory "$INSTDIR\data"

  ; 2. Cấp quyền Modify (M) cho nhóm Builtin Users (SID: *S-1-5-32-545) DUY NHẤT trên $INSTDIR\data
  ; (OI)(CI)(M):
  ;   OI: Object Inherit (kế thừa cho file con bên trong)
  ;   CI: Container Inherit (kế thừa cho thư mục con bên trong)
  ;   M:  Modify (Đọc, ghi, sửa, xóa file báo cáo Excel)
  ; Sử dụng SID *S-1-5-32-545 đảm bảo hoạt động chính xác trên mọi ngôn ngữ Windows.
  ; nsExec::Exec thực thi ngầm hoàn toàn (silent, không hiển thị cửa sổ console).
  nsExec::Exec 'icacls "$INSTDIR\data" /grant "*S-1-5-32-545":(OI)(CI)(M) /T'
!macroend

; QUAN TRỌNG: TUYỆT ĐỐI KHÔNG định nghĩa macro xóa $INSTDIR\data khi uninstall
; để bảo vệ toàn vẹn các file báo cáo DoanhThu_YYYY-MM-DD.xlsx đã lưu.
