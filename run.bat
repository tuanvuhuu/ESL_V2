@echo off
chcp 65001 > nul
title ESL v2 - Hệ Thống Quản Lý Trung Tâm Tiếng Anh
color 0B

echo =====================================================================
echo           HỆ THỐNG QUẢN LÝ 4 TRUNG TÂM TIẾNG ANH (ESL v2)
echo =====================================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LỖI] Không tìm thấy Node.js trên máy!
    echo Vui lòng cài đặt Node.js từ https://nodejs.org
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Đang tạo file .env từ .env.example...
        copy .env.example .env > nul
    )
)

if not exist "node_modules" (
    echo [INFO] Đang cài đặt thư viện cần thiết (npm install)...
    call npm install
)

if not exist "prisma\dev.db" (
    echo [INFO] Đang khởi tạo cơ sở dữ liệu SQLite và nạp dữ liệu mẫu...
    call npx prisma db push
    call npm run db:seed
)

echo [OK] Máy chủ khởi động tại: http://localhost:3000
echo.
echo ---------------------------------------------------------------------
echo  Tài khoản đăng nhập mẫu (Mật khẩu: matkhau123):
echo   - quanly   : Quản lý (Xem toàn bộ 4 trung tâm, lương, tài chính, báo cáo)
echo   - giaovu.a : Giáo vụ cơ sở A (Ghi danh, xếp lớp, thu tiền, điểm danh)
echo   - lan      : Giáo viên Ms Lan (Điểm danh, xem lớp dạy, lương cá nhân)
echo   - thu      : Trợ giảng Thư
echo ---------------------------------------------------------------------
echo.
echo Đang mở trình duyệt trong giây lát...

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

call npm run dev
