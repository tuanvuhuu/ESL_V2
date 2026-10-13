@echo off
title ESL v2 - Quan Ly Trung Tam Tieng Anh
color 0b

echo =====================================================================
echo           HE THONG QUAN LY 4 TRUNG TAM TIENG ANH (ESL v2)
echo =====================================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto no_node

if not exist ".env" if exist ".env.example" copy /y ".env.example" ".env" >nul

if exist ".next\prerender-manifest.json" rmdir /s /q ".next" >nul 2>nul

rem Luon cai them thu vien moi (neu co) sau khi lay code moi ve.
echo [INFO] Dang kiem tra thu vien npm...
call npm install --no-audit --no-fund

:check_db
if not exist "prisma\dev.db" goto do_seed
rem Database da co: them bang / cot moi theo schema, khong xoa du lieu.
echo [INFO] Dang cap nhat cau truc database...
call npx prisma db push
goto do_run

:do_seed
echo [INFO] Dang khoi tao database va du lieu mau...
call npx prisma db push
call npm run db:seed

:do_run
echo [OK] May chu dang khoi dong tai: http://localhost:3000
echo.
echo ---------------------------------------------------------------------
echo  Tai khoan mau - Mat khau: matkhau123
echo   - quanly   : Quan ly 4 trung tam
echo   - giaovu.a : Giao vu co so A
echo   - lan      : Giao vien Ms Lan
echo   - thu      : Tro giang Thu
echo ---------------------------------------------------------------------
echo.
echo Dang mo trinh duyet...
start http://localhost:3000

call npm run dev
goto :eof

:no_node
echo [LOI] Khong tim thay Node.js tren may!
echo Vui long cai dat Node.js tu https://nodejs.org
pause
exit /b 1
