import { z } from "zod";
import {
  computeMonthlySalary,
  computeSessionPay,
  detectOverlappingSessions,
  sessionDuration,
  type AdjustmentType,
  type OverlapPolicy,
  type SalaryAdjustment,
  type TeachingRole,
  type TeachingSession,
} from "@/lib/payroll";
import { canManagePayroll, canSeePayroll, type Viewer } from "@/lib/permissions";
import { logChange } from "./audit";
import { prisma } from "./db";
import { allow, badRequest, notFound } from "./http";

export const SaveTeacherRateInput = z.object({
  teacherId: z.number().int().positive(),
  role: z.enum(["TEACHER", "ASSISTANT"]),
  hourlyRate: z.number().int().min(0, "Đơn giá giờ không được âm"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày định dạng YYYY-MM-DD"),
  note: z.string().trim().max(500).optional().nullable(),
});

export const UpdateTeacherOverlapInput = z.object({
  teacherId: z.number().int().positive(),
  overlapPolicy: z.enum(["SINGLE", "FULL", "RATIO"]),
  overlapRatio: z.number().positive().max(5).optional(),
});

export const AddAdjustmentInput = z.object({
  payrollPeriodId: z.number().int().positive(),
  type: z.enum(["BONUS", "ALLOWANCE", "PENALTY"]),
  amount: z.number().int().positive("Số tiền điều chỉnh phải lớn hơn 0"),
  note: z.string().trim().min(3, "Vui lòng nhập lý do điều chỉnh"),
});

/** B1: sửa tay số phút tính lương của một buổi; `minutes` = null là bỏ sửa tay, quay về theo giờ bắt đầu / kết thúc. */
export const SetSessionPayrollInput = z.object({
  minutes: z.number().int().min(0, "Số phút không được âm").max(960, "Tối đa 960 phút").nullable(),
  note: z.string().trim().min(3, "Vui lòng nhập lý do sửa giờ").max(500),
});

/** Danh sách đơn giá giờ của giáo viên / trợ giảng */
export async function listTeacherRates(teacherId?: number) {
  return prisma.teacherRate.findMany({
    where: teacherId ? { teacherId } : undefined,
    include: { teacher: { select: { id: true, fullName: true, displayName: true, code: true } } },
    orderBy: [{ teacherId: "asc" }, { role: "asc" }, { effectiveDate: "desc" }],
  });
}

/** Lưu đơn giá giờ mới (chỉ Quản lý) */
export async function saveTeacherRate(input: z.infer<typeof SaveTeacherRateInput>, viewer: Viewer) {
  allow(canManagePayroll(viewer), "Chỉ Quản lý mới có quyền đặt đơn giá giờ");
  const validated = SaveTeacherRateInput.parse(input);

  return prisma.$transaction(async (tx) => {
    const teacher = await tx.teacher.findUnique({ where: { id: validated.teacherId } });
    if (!teacher) throw notFound("Không tìm thấy giáo viên");

    const rate = await tx.teacherRate.create({
      data: {
        teacherId: validated.teacherId,
        role: validated.role,
        hourlyRate: validated.hourlyRate,
        effectiveDate: validated.effectiveDate,
        note: validated.note ?? null,
      },
    });

    await logChange(tx, "TeacherRate", rate.id, "create", {
      teacher: teacher.fullName,
      role: rate.role,
      hourlyRate: rate.hourlyRate,
      effectiveDate: rate.effectiveDate,
    });

    return rate;
  });
}

/** Cập nhật tùy chọn tính lương khi trùng giờ (chỉ Quản lý) */
export async function updateTeacherOverlapSettings(input: z.infer<typeof UpdateTeacherOverlapInput>, viewer: Viewer) {
  allow(canManagePayroll(viewer), "Chỉ Quản lý mới có quyền đổi tùy chọn trùng giờ");
  const validated = UpdateTeacherOverlapInput.parse(input);

  const teacher = await prisma.teacher.update({
    where: { id: validated.teacherId },
    data: {
      overlapPolicy: validated.overlapPolicy,
      overlapRatio: validated.overlapRatio ?? 1.5,
    },
  });

  return teacher;
}

/** Lấy đơn giá áp dụng cho một buổi dạy dựa vào ngày hiệu lực */
function findEffectiveRate(rates: { role: string; hourlyRate: number; effectiveDate: string }[], role: TeachingRole, sessionDate: string): number {
  const matching = rates
    .filter((r) => r.role === role && r.effectiveDate <= sessionDate)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return matching[0]?.hourlyRate ?? 0;
}

/** Tính toán hoặc lấy bảng lương tháng của giáo viên */
export async function generateOrGetMonthlyPayroll(params: {
  month: string; // YYYY-MM
  centerId?: number;
  teacherId?: number;
  viewer: Viewer;
}) {
  const { month, centerId, teacherId, viewer } = params;
  allow(canSeePayroll(viewer), "Không có quyền xem bảng lương");

  // Tìm danh sách giáo viên cần tính
  const teachers = await prisma.teacher.findMany({
    where: {
      status: "ACTIVE",
      ...(teacherId ? { id: teacherId } : {}),
      ...(centerId ? { centers: { some: { centerId } } } : {}),
    },
    include: {
      rates: true,
      centers: { include: { center: true } },
    },
  });

  const results = [];

  for (const t of teachers) {
    // 1. Tìm các buổi dạy thực tế trong tháng
    const sessions = await prisma.classSession.findMany({
      where: {
        date: { startsWith: month },
        status: { not: "CANCELLED" },
        OR: [
          { teacherId: t.id }, // Dạy chính hoặc dạy thay
          { class: { assistants: { some: { teacherId: t.id } } } }, // Trợ giảng của lớp
        ],
      },
      include: {
        class: { select: { id: true, name: true, code: true, centerId: true, center: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // 2. Chuyển thành cấu trúc TeachingSession để tính toán
    const teachingSessions: TeachingSession[] = sessions.map((s) => {
      const isMain = s.teacherId === t.id;
      const role: TeachingRole = isMain ? "TEACHER" : "ASSISTANT";
      const rate = findEffectiveRate(t.rates, role, s.date);
      return {
        sessionId: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        centerId: s.class.centerId,
        role,
        hourlyRate: rate,
        durationMinutes: s.payrollMinutes ?? undefined,
      };
    });

    // 3. Tìm bản ghi PayrollPeriod hiện tại trong DB (nếu có)
    let period = await prisma.payrollPeriod.findUnique({
      where: { month_teacherId: { month, teacherId: t.id } },
      include: { adjustments: true },
    });

    // Nếu đã khóa hoặc đã thanh toán thì giữ nguyên số liệu đã chốt
    if (period && period.status !== "DRAFT") {
      results.push({
        period,
        teacher: t,
        sessionsCount: teachingSessions.length,
      });
      continue;
    }

    // 4. Tính toán lương mới từ danh sách buổi dạy và các điều chỉnh
    const adjustments: SalaryAdjustment[] = (period?.adjustments ?? []).map((a) => ({
      type: a.type as AdjustmentType,
      amount: a.amount,
      note: a.note,
    }));

    const calculated = computeMonthlySalary({
      sessions: teachingSessions,
      adjustments,
      overlapPolicy: (t.overlapPolicy as OverlapPolicy) ?? "SINGLE",
      defaultRatio: t.overlapRatio ?? 1.5,
    });

    const bonusPay = adjustments.filter((a) => a.type === "BONUS").reduce((s, a) => s + a.amount, 0);
    const allowancePay = adjustments.filter((a) => a.type === "ALLOWANCE").reduce((s, a) => s + a.amount, 0);
    const penaltyPay = adjustments.filter((a) => a.type === "PENALTY").reduce((s, a) => s + a.amount, 0);

    // 5. Cập nhật hoặc tạo mới bản ghi nháp
    if (!period) {
      period = await prisma.payrollPeriod.create({
        data: {
          month,
          teacherId: t.id,
          centerId: t.centers[0]?.centerId ?? null,
          status: "DRAFT",
          totalHours: calculated.totalHours,
          teachingPay: calculated.teachingPay,
          bonusPay,
          allowancePay,
          penaltyPay,
          finalPay: calculated.finalSalary,
        },
        include: { adjustments: true },
      });
    } else {
      period = await prisma.payrollPeriod.update({
        where: { id: period.id },
        data: {
          totalHours: calculated.totalHours,
          teachingPay: calculated.teachingPay,
          bonusPay,
          allowancePay,
          penaltyPay,
          finalPay: calculated.finalSalary,
        },
        include: { adjustments: true },
      });
    }

    results.push({
      period,
      teacher: t,
      sessionsCount: teachingSessions.length,
      calculated,
    });
  }

  return results;
}

/** Chốt bảng lương tháng (chỉ Quản lý) */
export async function lockPayrollPeriod(id: number, viewer: Viewer) {
  allow(canManagePayroll(viewer), "Chỉ Quản lý mới có quyền chốt bảng lương");

  return prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.findUnique({
      where: { id },
      include: { teacher: true },
    });
    if (!period) throw notFound("Không tìm thấy bảng lương");
    if (period.status !== "DRAFT") throw badRequest("Bảng lương này đã được chốt trước đó");

    const updated = await tx.payrollPeriod.update({
      where: { id },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        lockedBy: viewer.fullName,
      },
    });

    await logChange(tx, "PayrollPeriod", id, "lock", {
      month: period.month,
      teacher: period.teacher.fullName,
      finalPay: period.finalPay,
    });

    return updated;
  });
}

/** Ghi nhận đã thanh toán lương (chỉ Quản lý) */
export async function markPayrollPaid(id: number, viewer: Viewer) {
  allow(canManagePayroll(viewer), "Chỉ Quản lý mới có quyền đánh dấu đã thanh toán lương");

  return prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.findUnique({ where: { id }, include: { teacher: true } });
    if (!period) throw notFound("Không tìm thấy bảng lương");
    if (period.status === "PAID") throw badRequest("Bảng lương đã được thanh toán");

    const updated = await tx.payrollPeriod.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paidBy: viewer.fullName,
      },
    });

    await logChange(tx, "PayrollPeriod", id, "pay", {
      month: period.month,
      teacher: period.teacher.fullName,
      finalPay: period.finalPay,
    });

    return updated;
  });
}

/** Thêm khoản điều chỉnh (thưởng, phụ cấp, phạt) */
export async function addPayrollAdjustment(input: z.infer<typeof AddAdjustmentInput>, viewer: Viewer) {
  allow(canManagePayroll(viewer), "Chỉ Quản lý mới có quyền thêm điều chỉnh lương");
  const validated = AddAdjustmentInput.parse(input);

  return prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.findUnique({ where: { id: validated.payrollPeriodId } });
    if (!period) throw notFound("Không tìm thấy bảng lương");
    if (period.status !== "DRAFT") throw badRequest("Không thể sửa điều chỉnh trên bảng lương đã chốt");

    const adj = await tx.payrollAdjustment.create({
      data: {
        payrollPeriodId: period.id,
        type: validated.type,
        amount: validated.amount,
        note: validated.note,
        createdBy: viewer.fullName,
      },
    });

    // Cập nhật lại tổng tiền trên bảng lương
    const bonus = validated.type === "BONUS" ? validated.amount : 0;
    const allowance = validated.type === "ALLOWANCE" ? validated.amount : 0;
    const penalty = validated.type === "PENALTY" ? validated.amount : 0;

    await tx.payrollPeriod.update({
      where: { id: period.id },
      data: {
        bonusPay: { increment: bonus },
        allowancePay: { increment: allowance },
        penaltyPay: { increment: penalty },
        finalPay: { increment: bonus + allowance - penalty },
      },
    });

    return adj;
  });
}

/** Xóa khoản điều chỉnh lương */
export async function deletePayrollAdjustment(id: number, viewer: Viewer) {
  allow(canManagePayroll(viewer), "Chỉ Quản lý mới có quyền xóa điều chỉnh lương");

  return prisma.$transaction(async (tx) => {
    const adj = await tx.payrollAdjustment.findUnique({
      where: { id },
      include: { payrollPeriod: true },
    });
    if (!adj) throw notFound("Không tìm thấy khoản điều chỉnh");
    if (adj.payrollPeriod.status !== "DRAFT") throw badRequest("Không thể xóa điều chỉnh trên bảng lương đã chốt");

    await tx.payrollAdjustment.delete({ where: { id } });

    const bonus = adj.type === "BONUS" ? adj.amount : 0;
    const allowance = adj.type === "ALLOWANCE" ? adj.amount : 0;
    const penalty = adj.type === "PENALTY" ? adj.amount : 0;

    await tx.payrollPeriod.update({
      where: { id: adj.payrollPeriodId },
      data: {
        bonusPay: { decrement: bonus },
        allowancePay: { decrement: allowance },
        penaltyPay: { decrement: penalty },
        finalPay: { decrement: bonus + allowance - penalty },
      },
    });

    return { ok: true };
  });
}

/** Chi tiết buổi dạy và bảng lương cá nhân cho giáo viên/trợ giảng (DESIGN mục 4.2) */
export async function getTeacherMonthlyDetails(teacherId: number, month: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { rates: true },
  });
  if (!teacher) throw notFound("Không tìm thấy giáo viên");

  const sessions = await prisma.classSession.findMany({
    where: {
      date: { startsWith: month },
      status: { not: "CANCELLED" },
      OR: [
        { teacherId },
        { class: { assistants: { some: { teacherId } } } },
      ],
    },
    include: {
      class: { select: { id: true, name: true, code: true, center: true } },
      room: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const teachingSessions: TeachingSession[] = sessions.map((s) => {
    const isMain = s.teacherId === teacherId;
    const role: TeachingRole = isMain ? "TEACHER" : "ASSISTANT";
    const rate = findEffectiveRate(teacher.rates, role, s.date);
    return {
      sessionId: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      centerId: s.class.center.id,
      role,
      hourlyRate: rate,
      durationMinutes: s.payrollMinutes ?? undefined,
    };
  });

  const overlapGroups = detectOverlappingSessions(teachingSessions);
  const overlappingSessionIds = new Set(overlapGroups.flat().map((s) => s.sessionId));

  const detailedSessions = sessions.map((s, idx) => {
    const ts = teachingSessions[idx];
    const isOverlapping = overlappingSessionIds.has(s.id);
    const overlapCount = isOverlapping ? (overlapGroups.find((g) => g.some((x) => x.sessionId === s.id))?.length ?? 1) : 1;
    const pay = computeSessionPay(ts, overlapCount, (teacher.overlapPolicy as OverlapPolicy) ?? "SINGLE", teacher.overlapRatio ?? 1.5);
    const duration = sessionDuration(ts);

    return {
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      className: s.class.name,
      classCode: s.class.code,
      centerName: s.class.center.name,
      roomName: s.room.name,
      role: ts.role,
      hourlyRate: ts.hourlyRate,
      durationMinutes: duration,
      hours: duration / 60,
      isOverlapping,
      isManual: s.payrollMinutes != null,
      payrollNote: s.payrollNote,
      pay,
    };
  });

  const period = await prisma.payrollPeriod.findUnique({
    where: { month_teacherId: { month, teacherId } },
    include: { adjustments: true },
  });

  return {
    teacher,
    month,
    period,
    sessions: detailedSessions,
    totalHours: detailedSessions.reduce((s, x) => s + x.hours, 0),
    totalTeachingPay: detailedSessions.reduce((s, x) => s + x.pay, 0),
  };
}

/**
 * B1: sửa giờ tính lương của một buổi bằng tay, bắt buộc ghi lý do, ghi nhật ký thay đổi.
 * Chỉ Quản lý. Tháng đã chốt của người dạy (hoặc trợ giảng của lớp) thì không sửa được.
 */
export async function setSessionPayrollMinutes(sessionId: number, input: z.infer<typeof SetSessionPayrollInput>, viewer: Viewer) {
  allow(canManagePayroll(viewer), "Chỉ Quản lý mới có quyền sửa giờ tính lương");
  const data = SetSessionPayrollInput.parse(input);

  return prisma.$transaction(async (tx) => {
    const s = await tx.classSession.findUnique({
      where: { id: sessionId },
      include: { class: { include: { assistants: true } } },
    });
    if (!s) throw notFound("Không tìm thấy buổi học");
    if (s.status === "CANCELLED") throw badRequest("Buổi đã hủy không tính lương");

    const teacherIds = [s.teacherId, ...s.class.assistants.map((a) => a.teacherId)];
    const locked = await tx.payrollPeriod.findFirst({
      where: { month: s.date.slice(0, 7), teacherId: { in: teacherIds }, status: { not: "DRAFT" } },
    });
    if (locked) throw badRequest("Tháng lương này đã chốt, không sửa được giờ tính lương");

    const updated = await tx.classSession.update({
      where: { id: sessionId },
      data: { payrollMinutes: data.minutes, payrollNote: data.minutes == null ? null : data.note },
    });
    await logChange(tx, "Session", sessionId, "payroll-hours", {
      payrollMinutes: [s.payrollMinutes, updated.payrollMinutes],
      reason: [null, data.note],
    });
    return { id: updated.id, payrollMinutes: updated.payrollMinutes, payrollNote: updated.payrollNote };
  });
}
