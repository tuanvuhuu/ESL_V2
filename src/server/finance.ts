import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { computeDebtStatus, type DebtStatus } from "@/lib/finance";
import { todayISO } from "@/lib/dates";
import { canApproveRefund, canManageFinance, type Viewer } from "@/lib/permissions";
import { logChange } from "./audit";
import { prisma } from "./db";
import { allow, badRequest, notFound } from "./http";

type Tx = Prisma.TransactionClient | typeof prisma;

export const PaymentMethodSchema = z.enum(["CASH", "TRANSFER"]);
export const DiscountTypeSchema = z.enum(["SIBLING", "ALUMNI", "EARLY_BIRD", "SCHOLARSHIP", "PROMOTION"]);
export const DiscountModeSchema = z.enum(["PERCENT", "AMOUNT"]);

export const CreatePaymentInput = z.object({
  enrollmentId: z.number().int().positive(),
  amount: z.number().int().positive("Số tiền thu phải lớn hơn 0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày định dạng YYYY-MM-DD"),
  method: PaymentMethodSchema.default("CASH"),
  note: z.string().trim().max(500).optional().nullable(),
});

export const CreateRefundInput = z.object({
  enrollmentId: z.number().int().positive(),
  amount: z.number().int().positive("Số tiền hoàn phải lớn hơn 0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày định dạng YYYY-MM-DD"),
  reason: z.string().trim().min(3, "Vui lòng nhập lý do hoàn tiền"),
});

export const CreateExpenseInput = z.object({
  centerId: z.number().int().positive(),
  category: z.enum(["RENT", "UTILITIES", "MARKETING", "MATERIALS", "OTHER"]),
  amount: z.number().int().positive("Số tiền chi phải lớn hơn 0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày định dạng YYYY-MM-DD"),
  payer: z.string().trim().min(1, "Người chi tiền không được để trống"),
  note: z.string().trim().max(500).optional().nullable(),
});

/** Sinh mã định danh phiếu thu: PT-YYYYMM-XXXX */
async function generatePaymentCode(tx: Tx, date: string): Promise<string> {
  const prefix = `PT-${date.slice(0, 7).replace("-", "")}-`;
  const count = await tx.payment.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** Sinh mã hoàn tiền: HT-YYYYMM-XXXX */
async function generateRefundCode(tx: Tx, date: string): Promise<string> {
  const prefix = `HT-${date.slice(0, 7).replace("-", "")}-`;
  const count = await tx.refund.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** Sinh mã chi phí: CP-YYYYMM-XXXX */
async function generateExpenseCode(tx: Tx, date: string): Promise<string> {
  const prefix = `CP-${date.slice(0, 7).replace("-", "")}-`;
  const count = await tx.expense.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** Lập phiếu thu học phí mới */
export async function createPayment(input: z.infer<typeof CreatePaymentInput>, viewer: Viewer) {
  const validated = CreatePaymentInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.classEnrollment.findUnique({
      where: { id: validated.enrollmentId },
      include: { class: { select: { centerId: true, code: true } }, student: true },
    });
    if (!enrollment) throw notFound("Không tìm thấy ghi danh của học sinh");

    allow(canManageFinance(viewer, enrollment.class.centerId), "Không có quyền thu tiền tại trung tâm này");

    const code = await generatePaymentCode(tx, validated.date);
    const payment = await tx.payment.create({
      data: {
        code,
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        centerId: enrollment.class.centerId,
        amount: validated.amount,
        date: validated.date,
        method: validated.method,
        note: validated.note ?? null,
        createdBy: viewer.fullName,
      },
      include: { student: true, center: true, enrollment: { include: { class: true } } },
    });

    await logChange(tx, "Payment", payment.id, "create", {
      code,
      amount: payment.amount,
      student: enrollment.student.fullName,
      class: enrollment.class.code,
      method: payment.method,
    });

    return payment;
  });
}

/** Hủy phiếu thu kèm lý do (phiếu thu không được xóa, chỉ hủy kèm lý do) */
export async function cancelPayment(id: number, reason: string, viewer: Viewer) {
  if (!reason.trim()) throw badRequest("Vui lòng nhập lý do hủy phiếu thu");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id } });
    if (!payment) throw notFound("Không tìm thấy phiếu thu");
    allow(canManageFinance(viewer, payment.centerId), "Không có quyền hủy phiếu thu của trung tâm này");
    if (payment.status === "CANCELLED") throw badRequest("Phiếu thu này đã bị hủy trước đó");

    const updated = await tx.payment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: reason.trim(),
        cancelledAt: new Date(),
        cancelledBy: viewer.fullName,
      },
    });

    await logChange(tx, "Payment", payment.id, "cancel", {
      code: payment.code,
      reason,
      actor: viewer.fullName,
    });

    return updated;
  });
}

/** Duyệt và lập phiếu hoàn tiền (chỉ Quản lý) */
export async function createRefund(input: z.infer<typeof CreateRefundInput>, viewer: Viewer) {
  allow(canApproveRefund(viewer), "Chỉ Quản lý mới có quyền duyệt hoàn tiền");
  const validated = CreateRefundInput.parse(input);

  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.classEnrollment.findUnique({
      where: { id: validated.enrollmentId },
      include: {
        class: { include: { course: true } },
        student: true,
        attendances: true,
        payments: { where: { status: "VALID" } },
        refunds: { where: { status: "VALID" } },
      },
    });
    if (!enrollment) throw notFound("Không tìm thấy ghi danh");

    const totalPaid = enrollment.payments.reduce((s, p) => s + p.amount, 0);
    const totalRefunded = enrollment.refunds.reduce((s, r) => s + r.amount, 0);
    const maxRefundable = totalPaid - totalRefunded;

    if (validated.amount > maxRefundable) {
      throw badRequest(`Số tiền hoàn tối đa là ${maxRefundable.toLocaleString("vi-VN")} ₫ (Đã đóng: ${totalPaid.toLocaleString("vi-VN")} ₫, đã hoàn: ${totalRefunded.toLocaleString("vi-VN")} ₫)`);
    }

    // Tính số buổi chưa học để lưu vết tham khảo
    const attendedCount = enrollment.attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    const purchased = enrollment.purchasedSessions ?? enrollment.class.totalSessions;
    const unusedSessions = Math.max(0, purchased - attendedCount);

    const code = await generateRefundCode(tx, validated.date);
    const refund = await tx.refund.create({
      data: {
        code,
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        centerId: enrollment.class.centerId,
        amount: validated.amount,
        date: validated.date,
        reason: validated.reason,
        unusedSessions,
        approvedBy: viewer.fullName,
      },
      include: { student: true, center: true, enrollment: { include: { class: true } } },
    });

    await logChange(tx, "Refund", refund.id, "create", {
      code,
      amount: refund.amount,
      student: enrollment.student.fullName,
      unusedSessions,
      reason: refund.reason,
    });

    return refund;
  });
}

/** Danh sách phiếu thu */
export async function listPayments(params: {
  centerId?: number;
  studentId?: number;
  enrollmentId?: number;
  fromDate?: string;
  toDate?: string;
  status?: string;
}) {
  const where: Prisma.PaymentWhereInput = {};
  if (params.centerId) where.centerId = params.centerId;
  if (params.studentId) where.studentId = params.studentId;
  if (params.enrollmentId) where.enrollmentId = params.enrollmentId;
  if (params.status) where.status = params.status;
  if (params.fromDate || params.toDate) {
    where.date = {};
    if (params.fromDate) where.date.gte = params.fromDate;
    if (params.toDate) where.date.lte = params.toDate;
  }

  return prisma.payment.findMany({
    where,
    include: {
      student: { select: { id: true, fullName: true, code: true, englishName: true } },
      center: { select: { id: true, name: true, code: true, color: true } },
      enrollment: {
        select: {
          id: true,
          class: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
}

/** Tra cứu và tính toán công nợ học sinh theo trung tâm */
export async function getStudentDebts(params: {
  centerId?: number;
  search?: string;
  status?: DebtStatus | "ALL";
  today?: string;
}) {
  const today = params.today ?? todayISO();
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      leftAt: null,
      class: params.centerId ? { centerId: params.centerId } : undefined,
    },
    include: {
      student: { select: { id: true, fullName: true, code: true, englishName: true, searchText: true } },
      class: {
        select: {
          id: true,
          name: true,
          code: true,
          totalSessions: true,
          centerId: true,
          center: { select: { id: true, name: true, code: true, color: true } },
          course: { select: { id: true, name: true, tuition: true } },
        },
      },
      payments: { where: { status: "VALID" } },
      refunds: { where: { status: "VALID" } },
    },
  });

  const searchNorm = params.search?.trim().toLowerCase() ?? "";

  const items = enrollments
    .map((e) => {
      const standardTuition = e.class.course?.tuition ?? 0;
      const finalFee = e.tuitionFee ?? standardTuition;
      const paidSum = e.payments.reduce((s, p) => s + p.amount, 0);
      const refundSum = e.refunds.reduce((s, r) => s + r.amount, 0);
      const paidAmount = Math.max(0, paidSum - refundSum);

      const debt = computeDebtStatus({
        finalFee,
        paidAmount,
        dueDate: e.dueDate,
        today,
      });

      return {
        enrollmentId: e.id,
        student: e.student,
        class: e.class,
        center: e.class.center,
        finalFee,
        paidAmount,
        debtAmount: debt.debtAmount,
        status: debt.status,
        isOverdue: debt.isOverdue,
        overdueDays: debt.overdueDays,
        dueDate: e.dueDate,
        paymentsCount: e.payments.length,
      };
    })
    .filter((item) => {
      if (params.status && params.status !== "ALL" && item.status !== params.status) return false;
      if (searchNorm) {
        const match =
          item.student.fullName.toLowerCase().includes(searchNorm) ||
          item.student.code.toLowerCase().includes(searchNorm) ||
          item.class.name.toLowerCase().includes(searchNorm) ||
          item.class.code.toLowerCase().includes(searchNorm);
        if (!match) return false;
      }
      return true;
    });

  const totalFee = items.reduce((s, i) => s + i.finalFee, 0);
  const totalPaid = items.reduce((s, i) => s + i.paidAmount, 0);
  const totalDebt = items.reduce((s, i) => s + i.debtAmount, 0);
  const overdueCount = items.filter((i) => i.isOverdue).length;

  return {
    items,
    summary: {
      totalCount: items.length,
      totalFee,
      totalPaid,
      totalDebt,
      overdueCount,
    },
  };
}

/** Danh sách chi phí */
export async function listExpenses(params: {
  centerId?: number;
  category?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const where: Prisma.ExpenseWhereInput = {};
  if (params.centerId) where.centerId = params.centerId;
  if (params.category) where.category = params.category;
  if (params.fromDate || params.toDate) {
    where.date = {};
    if (params.fromDate) where.date.gte = params.fromDate;
    if (params.toDate) where.date.lte = params.toDate;
  }

  return prisma.expense.findMany({
    where,
    include: { center: { select: { id: true, name: true, code: true, color: true } } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
}

/** Ghi nhận chi phí hoạt động mới */
export async function createExpense(input: z.infer<typeof CreateExpenseInput>, viewer: Viewer) {
  const validated = CreateExpenseInput.parse(input);
  allow(canManageFinance(viewer, validated.centerId), "Không có quyền nhập chi phí cho trung tâm này");

  return prisma.$transaction(async (tx) => {
    const code = await generateExpenseCode(tx, validated.date);
    const expense = await tx.expense.create({
      data: {
        code,
        centerId: validated.centerId,
        category: validated.category,
        amount: validated.amount,
        date: validated.date,
        payer: validated.payer,
        note: validated.note ?? null,
        createdBy: viewer.fullName,
      },
      include: { center: true },
    });

    await logChange(tx, "Expense", expense.id, "create", {
      code,
      amount: expense.amount,
      category: expense.category,
      center: expense.center.name,
    });

    return expense;
  });
}

/** Xóa chi phí (chỉ Quản lý hoặc Giáo vụ cùng trung tâm) */
export async function deleteExpense(id: number, viewer: Viewer) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({ where: { id }, include: { center: true } });
    if (!expense) throw notFound("Không tìm thấy khoản chi");
    allow(canManageFinance(viewer, expense.centerId), "Không có quyền xóa chi phí của trung tâm này");

    await tx.expense.delete({ where: { id } });
    await logChange(tx, "Expense", id, "delete", { code: expense.code, amount: expense.amount });
    return { ok: true };
  });
}

/** B6: các khóa trước của học sinh còn nợ học phí (khóa đang học hoặc đã kết thúc, không tính khóa đã chuyển đi). Chỉ để cảnh báo, không chặn xếp lớp. */
export async function priorDebtsForStudent(tx: Prisma.TransactionClient | typeof prisma, studentId: number, excludeClassId: number, today = todayISO()) {
  const rows = await tx.classEnrollment.findMany({
    where: { studentId, classId: { not: excludeClassId }, OR: [{ leftAt: null }, { class: { status: "FINISHED" } }], class: { status: { not: "CANCELLED" } } },
    include: {
      class: { select: { code: true, name: true, course: { select: { tuition: true } } } },
      payments: { where: { status: "VALID" } },
      refunds: { where: { status: "VALID" } },
    },
  });
  return rows
    .map((e) => {
      const finalFee = e.tuitionFee ?? e.class.course?.tuition ?? 0;
      const paid = Math.max(0, e.payments.reduce((s, p) => s + p.amount, 0) - e.refunds.reduce((s, r) => s + r.amount, 0));
      const debt = computeDebtStatus({ finalFee, paidAmount: paid, dueDate: e.dueDate, today });
      return { enrollmentId: e.id, classCode: e.class.code, className: e.class.name, debtAmount: debt.debtAmount, isOverdue: debt.isOverdue };
    })
    .filter((d) => d.debtAmount > 0);
}
