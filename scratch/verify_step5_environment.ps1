# Script kiem tra trang thai thuc te cua C:\Program Files\POSA truoc va sau khi cai dat

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "KIEM TRA THUC TE BUOC 5: C:\Program Files\POSA & DATA ACL" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

$posaDir = "C:\Program Files\POSA"
$dataDir = "C:\Program Files\POSA\data"
$posaExe = "C:\Program Files\POSA\posa.exe"

# 1. Kiem tra thu muc va file posa.exe
Write-Host "`n1. Kiem tra su ton tai:" -ForegroundColor Yellow
Write-Host "  - Thu muc POSA: $(Test-Path $posaDir)"
Write-Host "  - Thu muc data: $(Test-Path $dataDir)"
Write-Host "  - File posa.exe: $(Test-Path $posaExe)"

if (Test-Path $posaExe) {
    $exeItem = Get-Item $posaExe
    Write-Host "  - posa.exe version / write time: $($exeItem.LastWriteTime)"
}

# 2. Kiem tra quyen ghi thuc te bang tai khoan User hien tai (khong can Admin)
Write-Host "`n2. Kiem tra quyen ghi thuc te vao data bang user hien tai:" -ForegroundColor Yellow
$testFile = "$dataDir\__test_write_perm.tmp"
try {
    [System.IO.File]::WriteAllText($testFile, "test")
    Remove-Item $testFile -Force
    Write-Host "  -> KET QUA: GHI THANH CONG! User thuong da co quyen Modify/Write tren data." -ForegroundColor Green
    $canWrite = $true
} catch {
    Write-Host "  -> KET QUA: GHI THAT BAI: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  -> (Nguyen nhan: Bo cai moi chua duoc chay de ap dung hooks.nsh)" -ForegroundColor DarkYellow
    $canWrite = $false
}

# 3. Kiem tra ACL chi tiet cua C:\Program Files\POSA\data
Write-Host "`n3. Danh sach ACL hien tai cua ${dataDir}:" -ForegroundColor Yellow
$dataAcl = (Get-Acl $dataDir).Access | Select-Object IdentityReference, AccessControlType, FileSystemRights, IsInherited
$dataAcl | Format-Table -AutoSize | Out-String | Write-Host

# 4. Kiem tra ACL cua posa.exe (phai giu nguyen bao ve, khong duoc cho User quyen Modify)
Write-Host "`n4. Kiem tra bao ve cua posa.exe:" -ForegroundColor Yellow
$exeAcl = (Get-Acl $posaExe).Access | Where-Object { $_.IdentityReference -match "Users" -or $_.IdentityReference -match "S-1-5-32-545" }
$exeAcl | Format-Table -AutoSize | Out-String | Write-Host

# 5. Kiem tra danh sach file DoanhThu hien co trong data
Write-Host "`n5. Danh sach file trong data:" -ForegroundColor Yellow
$excelFiles = Get-ChildItem -Path $dataDir -Filter "*.xlsx" -ErrorAction SilentlyContinue
if ($excelFiles.Count -eq 0) {
    Write-Host "  (Chua co file .xlsx nao)" -ForegroundColor Gray
} else {
    foreach ($f in $excelFiles) {
        Write-Host "  - $($f.Name) ($($f.Length) bytes, $($f.LastWriteTime))"
    }
}
Write-Host "==================================================================" -ForegroundColor Cyan
