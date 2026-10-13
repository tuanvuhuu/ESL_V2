-- B4: lịch sử cách tính trùng giờ có ngày hiệu lực. Chỉ THÊM bảng mới, không xóa hay sửa dữ liệu cũ.
CREATE TABLE "TeacherOverlapPolicy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teacherId" INTEGER NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "overlapPolicy" TEXT NOT NULL,
    "overlapRatio" REAL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherOverlapPolicy_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeacherOverlapPolicy_teacherId_effectiveDate_key" ON "TeacherOverlapPolicy"("teacherId", "effectiveDate");
