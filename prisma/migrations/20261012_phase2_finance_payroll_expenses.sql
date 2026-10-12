-- Migration: 20261012_phase2_finance_payroll_expenses.sql
-- Thêm các bảng và trường cho phân hệ Tài chính (Học phí, Công nợ, Chi phí) và Lương (Đơn giá, Bảng lương tháng)

-- 1. Cập nhật bảng ClassEnrollment: thêm học phí thỏa thuận, giảm giá và hạn đóng
ALTER TABLE "ClassEnrollment" ADD COLUMN "tuitionFee" INTEGER;
ALTER TABLE "ClassEnrollment" ADD COLUMN "discountType" TEXT;
ALTER TABLE "ClassEnrollment" ADD COLUMN "discountMode" TEXT;
ALTER TABLE "ClassEnrollment" ADD COLUMN "discountValue" INTEGER;
ALTER TABLE "ClassEnrollment" ADD COLUMN "dueDate" TEXT;

-- 2. Cập nhật bảng Teacher: thêm cấu hình tính lương khi trùng giờ
ALTER TABLE "Teacher" ADD COLUMN "overlapPolicy" TEXT NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "Teacher" ADD COLUMN "overlapRatio" REAL DEFAULT 1.5;

-- 3. Tạo bảng Payment (Phiếu thu học phí)
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "centerId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "cancelReason" TEXT,
    "cancelledAt" DATETIME,
    "cancelledBy" TEXT,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ClassEnrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_code_key" ON "Payment"("code");
CREATE INDEX IF NOT EXISTS "Payment_enrollmentId_idx" ON "Payment"("enrollmentId");
CREATE INDEX IF NOT EXISTS "Payment_studentId_idx" ON "Payment"("studentId");
CREATE INDEX IF NOT EXISTS "Payment_centerId_date_idx" ON "Payment"("centerId", "date");

-- 4. Tạo bảng Refund (Hoàn tiền học phí)
CREATE TABLE IF NOT EXISTS "Refund" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "centerId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "unusedSessions" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "cancelReason" TEXT,
    "cancelledAt" DATETIME,
    "cancelledBy" TEXT,
    "approvedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Refund_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ClassEnrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Refund_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Refund_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_code_key" ON "Refund"("code");
CREATE INDEX IF NOT EXISTS "Refund_enrollmentId_idx" ON "Refund"("enrollmentId");
CREATE INDEX IF NOT EXISTS "Refund_studentId_idx" ON "Refund"("studentId");
CREATE INDEX IF NOT EXISTS "Refund_centerId_date_idx" ON "Refund"("centerId", "date");

-- 5. Tạo bảng TeacherRate (Đơn giá giờ dạy theo hiệu lực)
CREATE TABLE IF NOT EXISTS "TeacherRate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teacherId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEACHER',
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
    "effectiveDate" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherRate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TeacherRate_teacherId_role_idx" ON "TeacherRate"("teacherId", "role");

-- 6. Tạo bảng PayrollPeriod (Bảng lương tháng)
CREATE TABLE IF NOT EXISTS "PayrollPeriod" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "month" TEXT NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "centerId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalHours" REAL NOT NULL DEFAULT 0,
    "teachingPay" INTEGER NOT NULL DEFAULT 0,
    "bonusPay" INTEGER NOT NULL DEFAULT 0,
    "allowancePay" INTEGER NOT NULL DEFAULT 0,
    "penaltyPay" INTEGER NOT NULL DEFAULT 0,
    "finalPay" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "paidAt" DATETIME,
    "paidBy" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollPeriod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollPeriod_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPeriod_month_teacherId_key" ON "PayrollPeriod"("month", "teacherId");
CREATE INDEX IF NOT EXISTS "PayrollPeriod_month_idx" ON "PayrollPeriod"("month");

-- 7. Tạo bảng PayrollAdjustment (Điều chỉnh lương: thưởng/phụ cấp/phạt)
CREATE TABLE IF NOT EXISTS "PayrollAdjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "payrollPeriodId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollAdjustment_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PayrollAdjustment_payrollPeriodId_idx" ON "PayrollAdjustment"("payrollPeriodId");

-- 8. Tạo bảng Expense (Chi phí hoạt động trung tâm)
CREATE TABLE IF NOT EXISTS "Expense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "centerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_code_key" ON "Expense"("code");
CREATE INDEX IF NOT EXISTS "Expense_centerId_date_idx" ON "Expense"("centerId", "date");
CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense"("category");
