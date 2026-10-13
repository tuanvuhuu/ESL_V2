-- E1: bài tập về nhà giao theo buổi và chấm bài tập từng học sinh. Chỉ THÊM cột, không xóa hay sửa dữ liệu cũ.
ALTER TABLE "ClassSession" ADD COLUMN "homework" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "homework" TEXT;
