-- B1: giờ tính lương sửa tay từng buổi. Chỉ THÊM cột, không xóa hay sửa dữ liệu cũ.
-- Tuấn tự chạy (agent không chạy prisma db push / migrate). Sau đó chạy: npx prisma generate
ALTER TABLE "ClassSession" ADD COLUMN "payrollMinutes" INTEGER;
ALTER TABLE "ClassSession" ADD COLUMN "payrollNote" TEXT;
