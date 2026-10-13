import { z } from "zod";
import { todayISO } from "@/lib/dates";
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
import { canEditCenter, canManagePayroll, canSeePayroll, type Viewer } from "@/lib/permissions";
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
  /** B4: ngày bắt đầu áp dụng (YYYY-MM-DD), mặc định hôm nay. Buổi dạy trước ngày này giữ cách cũ. */
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày định dạng YYYY-MM-DD").optional(),
  note: z.string().trim().max(500).optional().nullable(),
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

/**
 * Cập nhật cách tính lương khi trùng giờ (chỉ Quản lý), có ngày hiệu lực (B4).
 * Buổi dạy trước ngày hiệu lực giữ cách cũ. Ngày hiệu lực không được rơi vào tháng đã chốt hoặc đã trả lương của giáo viên đó,
 * để tháng đã chốt luôn giữ nguyên cách tính cũ.
 */
export async function updateTeacherOverlapSettings(input: z.infer<typeof UpdateTeacherOverlapInput>, viewer: Viewer) {
  allow(canManagePayroll(viewer), "Chỉ Quản lý mới có quyền đổi tùy chọn trùng giờ");
  const validated = UpdateTeacherOverlapInput.parse(input);
  const effectiveDate = validated.effectiveDate ?? todayISO();
  const ratio = validated.overlapRatio ?? 1.5;

  return prisma.$transaction(async (tx) => {
    const teacher = await tx.teacher.findUnique({ where: { id: validated.teacherId }, include: { overlapHistory: true } });
    if (!teacher) throw notFound("Không tìm thấy giáo viên");

    const locked = await tx.payrollPeriod.findFirst({
      where: { teacherId: teacher.id, month: { gte: effectiveDate.slice(0, 7) }, status: { not: "DRAFT" } },
    });
    if (locked) throw badRequest(`Tháng ${locked.month} đã chốt lương, ngày hiệu lực phải sau tháng đã chốt`);

    // Lần đầu có lịch sử: lưu cách cũ làm mốc từ đầu, để buổi trước ngày hiệu lực không bị đổi theo.
    if (teacher.overlapHistory.length === 0) {
      await tx.teacherOverlapPolicy.create({
        data: { teacherId: teacher.id, effectiveDate: OVERLAP_BASELINE_DATE, overlapPolicy: teacher.overlapPolicy, overlapRatio: teacher.overlapRatio, note: "Cách tính trước khi có lịch sử", createdBy: viewer.fullName },
      });
    }
    await tx.teacherOverlapPolicy.upsert({
      where: { teacherId_effectiveDate: { teacherId: teacher.id, effectiveDate } },
      create: { teacherId: teacher.id, effectiveDate, overlapPolicy: validated.overlapPolicy, overlapRatio: ratio, note: validated.note ?? null, createdBy: viewer.fullName },
      update: { overlapPolicy: validated.overlapPolicy, overlapRatio: ratio, note: validated.note ?? null, createdBy: viewer.fullName },
    });

    // Teacher.overlapPolicy luôn là cách mới nhất (hiển thị trên màn hình); phép tính dùng lịch sử theo ngày buổi dạy.
    const latest = await tx.teacherOverlapPolicy.findFirstOrThrow({ where: { teacherId: teacher.id }, orderBy: { effectiveDate: "desc" } });
    const updated = await tx.teacher.update({
      where: { id: teacher.id },
      data: { overlapPolicy: latest.overlapPolicy, overlapRatio: latest.overlapRatio ?? 1.5 },
    });
    await logChange(tx, "Teacher", teacher.id, "overlap-policy", {
      overlapPolicy: [teacher.overlapPolicy, validated.overlapPolicy],
      effectiveDate: [null, effectiveDate],
    });
    return updated;
  });
}

/** B4: lịch sử cách tính trùng giờ của giáo viên, mới nhất trước. */
export async function listTeacherOverlapHistory(teacherId: number) {
  return prisma.teacherOverlapPolicy.findMany({ where: { teacherId }, orderBy: { effectiveDate: "desc" } });
}

/** B4: ngày mốc cho cách tính cũ (trước mọi ngày hiệu lực). */
const OVERLAP_BASELINE_DATE = "0000-01-01";

type OverlapRule = { policy: OverlapPolicy; ratio: number };

const ruleFields = (r: OverlapRule) => ({ overlapPolicy: r.policy, overlapRatio: r.ratio });

/** B4: cách tính trùng giờ áp dụng cho buổi dạy ngày `date`: dòng lịch sử mới nhất có ngày hiệu lực <= `date`; chưa có lịch sử thì dùng cài đặt hiện tại. */
export function overlapRuleAt(
  t: { overlapPolicy: string; overlapRatio: number | null; overlapHistory: { effectiveDate: string; overlapPolicy: string; overlapRatio: number | null }[] },
  date: string,
): OverlapRule {
  const row = t.overlapHistory
    .filter((h) => h.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  if (row) return { policy: (row.overlapPolicy as OverlapPolicy) ?? "SINGLE", ratio: row.overlapRatio ?? 1.5 };
  if (t.overlapHistory.length > 0) {
    const first = [...t.overlapHistory].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))[0];
    return { policy: (first.overlapPolicy as OverlapPolicy) ?? "SINGLE", ratio: first.overlapRatio ?? 1.5 };
  }
  return { policy: (t.overlapPolicy as OverlapPolicy) ?? "SINGLE", ratio: t.overlapRatio ?? 1.5 };
}
/** B2: điều kiện lọc các buổi mà `teacherId` được tính lương (dạy chính/dạy thay, trợ giảng riêng của buổi, hoặc trợ giảng cả lớp khi buổi không có trợ giảng riêng). */
function sessionsOfTeacherWhere(teacherId: number) {
  return [
    { teacherId },
    { assistants: { some: { teacherId } } },
    { AND: [{ assistants: { none: {} } }, { class: { assistants: { some: { teacherId } } } }] },
  ];
}

/** B2: số phút tính lương của một buổi cho `teacherId`: trợ giảng dùng số phút riêng của mình trước, rồi mới tới giờ sửa tay (B1). */
function payrollMinutesFor(s: { teacherId: number; payrollMinutes: number | null; assistants: { teacherId: number; minutes: number | null }[] }, teacherId: number): number | undefined {
  if (s.teacherId !== teacherId) {
    const own = s.assistants.find((a) => a.teacherId === teacherId)?.minutes;
    if (own != null) return own;
  }
  return s.payrollMinutes ?? undefined;
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
      overlapHistory: true,
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
        OR: sessionsOfTeacherWhere(t.id), // Dạy chính/dạy thay, trợ giảng của buổi hoặc của lớp
      },
      include: {
        class: { select: { id: true, name: true, code: true, centerId: true, center: true } },
        assistants: true,
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
        durationMinutes: payrollMinutesFor(s, t.id),
        ...ruleFields(overlapRuleAt(t, s.date)),
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
    include: { rates: true, overlapHistory: true },
  });
  if (!teacher) throw notFound("Không tìm thấy giáo viên");

  const sessions = await prisma.classSession.findMany({
    where: {
      date: { startsWith: month },
      status: { not: "CANCELLED" },
      OR: sessionsOfTeacherWhere(teacherId),
    },
    include: {
      class: { select: { id: true, name: true, code: true, center: true } },
      room: { select: { name: true } },
      assistants: true,
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
      durationMinutes: payrollMinutesFor(s, teacherId),
      ...ruleFields(overlapRuleAt(teacher, s.date)),
    };
  });

  const overlapGroups = detectOverlappingSessions(teachingSessions);
  const overlappingSessionIds = new Set(overlapGroups.flat().map((s) => s.sessionId));

  const detailedSessions = sessions.map((s, idx) => {
    const ts = teachingSessions[idx];
    const isOverlapping = overlappingSessionIds.has(s.id);
    const overlapCount = isOverlapping ? (overlapGroups.find((g) => g.some((x) => x.sessionId === s.id))?.length ?? 1) : 1;
    const pay = computeSessionPay(ts, overlapCount, ts.overlapPolicy ?? "SINGLE", ts.overlapRatio);
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
      isManual: s.payrollMinutes != null || (ts.role === "ASSISTANT" && s.assistants.find((a) => a.teacherId === teacherId)?.minutes != null),
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
      include: { class: { include: { assistants: true } }, assistants: true },
    });
    if (!s) throw notFound("Không tìm thấy buổi học");
    if (s.status === "CANCELLED") throw badRequest("Buổi đã hủy không tính lương");

    const teacherIds = [s.teacherId, ...s.class.assistants.map((a) => a.teacherId), ...s.assistants.map((a) => a.teacherId)];
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

/** B2: danh sách trợ giảng riêng của một buổi. Danh sách rỗng = quay về trợ giảng cả lớp. */
export const SetSessionAssistantsInput = z.object({
  assistants: z
    .array(
      z.object({
        teacherId: z.number().int().positive(),
        minutes: z.number().int().min(0, "Số phút không được âm").max(960, "Tối đa 960 phút").nullable().optional(),
      }),
    )
    .max(10, "Tối đa 10 trợ giảng"),
});

/**
 * B2: gắn trợ giảng theo từng buổi, kèm số phút có mặt riêng (trống = bằng thời lượng buổi), dùng khi tính lương.
 * Quản lý hoặc Giáo vụ của trung tâm. Tháng đã chốt của người bị ảnh hưởng thì không sửa được.
 */
export async function setSessionAssistants(sessionId: number, input: z.infer<typeof SetSessionAssistantsInput>, viewer: Viewer) {
  const data = SetSessionAssistantsInput.parse(input);

  return prisma.$transaction(async (tx) => {
    const s = await tx.classSession.findUnique({
      where: { id: sessionId },
      include: { class: { include: { assistants: true } }, assistants: true },
    });
    if (!s) throw notFound("Không tìm thấy buổi học");
    allow(canEditCenter(viewer, s.class.centerId), "Không có quyền sửa trợ giảng của buổi này");
    if (s.status === "CANCELLED") throw badRequest("Buổi đã hủy không tính lương");

    const ids = data.assistants.map((a) => a.teacherId);
    if (new Set(ids).size !== ids.length) throw badRequest("Một trợ giảng chỉ được thêm một lần");
    if (ids.includes(s.teacherId)) throw badRequest("Người dạy chính không thể là trợ giảng của cùng buổi");
    const found = await tx.teacher.count({ where: { id: { in: ids }, status: "ACTIVE" } });
    if (found !== ids.length) throw badRequest("Có trợ giảng không tồn tại hoặc đã nghỉ");

    const affected = [...new Set([...ids, ...s.assistants.map((a) => a.teacherId), ...s.class.assistants.map((a) => a.teacherId)])];
    const locked = await tx.payrollPeriod.findFirst({
      where: { month: s.date.slice(0, 7), teacherId: { in: affected }, status: { not: "DRAFT" } },
    });
    if (locked) throw badRequest("Tháng lương này đã chốt, không sửa được trợ giảng của buổi");

    await tx.sessionAssistant.deleteMany({ where: { sessionId } });
    for (const a of data.assistants) {
      await tx.sessionAssistant.create({ data: { sessionId, teacherId: a.teacherId, minutes: a.minutes ?? null } });
    }
    await logChange(tx, "Session", sessionId, "assistants", {
      assistants: [
        s.assistants.map((a) => `${a.teacherId}:${a.minutes ?? "-"}`).join(",") || null,
        data.assistants.map((a) => `${a.teacherId}:${a.minutes ?? "-"}`).join(",") || null,
      ],
    });
    return tx.sessionAssistant.findMany({ where: { sessionId }, orderBy: { teacherId: "asc" } });
  });
}

/** B2: trợ giảng đang áp dụng cho buổi: riêng của buổi nếu có, không thì của cả lớp. */
export async function getSessionAssistants(sessionId: number) {
  const s = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      assistants: { include: { teacher: { select: { id: true, displayName: true } } } },
      class: { include: { assistants: { include: { teacher: { select: { id: true, displayName: true } } } } } },
    },
  });
  if (!s) throw notFound("Không tìm thấy buổi học");
  if (s.assistants.length > 0) {
    return { source: "SESSION" as const, assistants: s.assistants.map((a) => ({ teacherId: a.teacherId, name: a.teacher.displayName, minutes: a.minutes })) };
  }
  return { source: "CLASS" as const, assistants: s.class.assistants.map((a) => ({ teacherId: a.teacherId, name: a.teacher.displayName, minutes: null as number | null })) };
}

/**
 * B3: chi phí lương của từng trung tâm trong tháng, tính theo trung tâm NƠI BUỔI DẠY DIỄN RA (không theo trung tâm chính của giáo viên).
 * Tiền dạy của mỗi bảng lương chia theo tỷ lệ tiền từng buổi ở từng trung tâm; thưởng, phụ cấp, phạt (chênh giữa tổng thực nhận và tiền dạy)
 * tính vào trung tâm của bảng lương, hoặc trung tâm dạy nhiều nhất nếu bảng lương không gắn trung tâm. Tổng các trung tâm luôn bằng tổng thực nhận.
 */
export async function payrollCostByCenter(month: string): Promise<Map<number, number>> {
  const periods = await prisma.payrollPeriod.findMany({ where: { month }, include: { teacher: { include: { rates: true, overlapHistory: true } } } });
  const cost = new Map<number, number>();
  const add = (centerId: number | null, amount: number) => {
    if (centerId == null || amount === 0) return;
    cost.set(centerId, (cost.get(centerId) ?? 0) + amount);
  };

  for (const p of periods) {
    const t = p.teacher;
    const sessions = await prisma.classSession.findMany({
      where: { date: { startsWith: month }, status: { not: "CANCELLED" }, OR: sessionsOfTeacherWhere(t.id) },
      include: { class: { select: { centerId: true } }, assistants: true },
    });
    const ts: TeachingSession[] = sessions.map((s) => {
      const role: TeachingRole = s.teacherId === t.id ? "TEACHER" : "ASSISTANT";
      return {
        sessionId: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        centerId: s.class.centerId,
        role,
        hourlyRate: findEffectiveRate(t.rates, role, s.date),
        durationMinutes: payrollMinutesFor(s, t.id),
        ...ruleFields(overlapRuleAt(t, s.date)),
      };
    });
    const groups = detectOverlappingSessions(ts);
    const perCenter = new Map<number, number>();
    for (const x of ts) {
      const g = groups.find((grp) => grp.some((y) => y.sessionId === x.sessionId));
      const pay = computeSessionPay(x, g ? g.length : 1, x.overlapPolicy ?? "SINGLE", x.overlapRatio);
      perCenter.set(x.centerId, (perCenter.get(x.centerId) ?? 0) + pay);
    }
    const totalPay = [...perCenter.values()].reduce((a, b) => a + b, 0);
    const main = [...perCenter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const extraCenter = p.centerId ?? main;
    const extra = p.finalPay - p.teachingPay;

    if (totalPay <= 0 || main == null) {
      add(extraCenter, p.teachingPay + extra);
      continue;
    }
    let given = 0;
    for (const [centerId, pay] of perCenter) {
      if (centerId === main) continue;
      const part = Math.round((p.teachingPay * pay) / totalPay);
      add(centerId, part);
      given += part;
    }
    add(main, p.teachingPay - given);
    add(extraCenter, extra);
  }
  return cost;
}