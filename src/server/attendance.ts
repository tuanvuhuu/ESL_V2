// Danh sách điểm danh của một buổi, số buổi còn lại theo ghi danh, quyền điểm danh.
import type { Prisma } from "@prisma/client";
import { computeBalance, type Balance } from "@/lib/attendance";
import { reservationCovers, type ReservationLite } from "@/lib/availability";
import { canEditCenter, isManager, isStaff, type Viewer } from "@/lib/permissions";
import { prisma } from "./db";
import { allow, notFound } from "./http";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Số buổi còn lại của từng ghi danh. */
export async function balancesFor(tx: Tx, enrollmentIds: number[]): Promise<Map<number, Balance>> {
  if (enrollmentIds.length === 0) return new Map();
  const rows = await tx.classEnrollment.findMany({
    where: { id: { in: enrollmentIds } },
    select: {
      id: true,
      purchasedSessions: true,
      adjustment: true,
      class: { select: { totalSessions: true } },
      attendances: { select: { status: true, makeup: { select: { absence: { select: { status: true } } } } } },
    },
  });
  return new Map(
    rows.map((e) => [
      e.id,
      computeBalance(
        e.purchasedSessions ?? e.class.totalSessions,
        e.adjustment,
        e.attendances.map((a) => ({ status: a.status, makeupOfStatus: a.makeup?.absence.status ?? null })),
      ),
    ]),
  );
}

const sessionInclude = {
  room: { select: { name: true } },
  teacher: { select: { id: true, displayName: true } },
  class: {
    select: {
      id: true,
      code: true,
      name: true,
      centerId: true,
      teacherId: true,
      center: { select: { id: true, name: true, color: true } },
      assistants: { select: { teacherId: true, teacher: { select: { displayName: true } } } },
    },
  },
} satisfies Prisma.ClassSessionInclude;

export type SessionWithClass = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;

export async function loadSession(tx: Tx, id: number): Promise<SessionWithClass> {
  const s = await tx.classSession.findUnique({ where: { id }, include: sessionInclude });
  if (!s) throw notFound("Không tìm thấy buổi học");
  return s;
}

/** Vai trò của người đăng nhập trong buổi: người dạy, trợ giảng, hoặc không liên quan. */
export function staffRoleIn(v: Viewer, s: SessionWithClass): "teacher" | "assistant" | null {
  if (v.teacherId == null) return null;
  if (s.teacherId === v.teacherId) return "teacher";
  if (s.class.assistants.some((a) => a.teacherId === v.teacherId)) return "assistant";
  return null;
}

/** Người dạy, trợ giảng của buổi (Q3: trợ giảng được điểm danh), giáo vụ trung tâm của lớp, quản lý. */
export function canTakeAttendanceFor(v: Viewer, s: SessionWithClass): boolean {
  if (isManager(v)) return true;
  if (isStaff(v)) return staffRoleIn(v, s) !== null;
  return canEditCenter(v, s.class.centerId);
}

/** Xem danh sách điểm danh: như trên, cộng giáo viên chính của lớp và giáo vụ trung tâm khác (chỉ xem). */
export function assertCanViewAttendance(v: Viewer, s: SessionWithClass) {
  if (!isStaff(v)) return;
  if (staffRoleIn(v, s) || s.class.teacherId === v.teacherId) return;
  throw notFound("Không tìm thấy buổi học");
}

export function assertCanTakeAttendance(v: Viewer, s: SessionWithClass) {
  allow(canTakeAttendanceFor(v, s), "Chỉ người dạy, trợ giảng của buổi hoặc giáo vụ trung tâm được điểm danh");
}

export type RosterRow = {
  studentId: number;
  enrollmentId: number;
  code: string;
  fullName: string;
  englishName: string | null;
  centerColor: string;
  /** Có giá trị nếu là học sinh học bù. */
  makeup: { id: number; fromClassCode: string; fromDate: string } | null;
  status: string | null;
  comment: string | null;
  balance: Balance | null;
};

/**
 * Không điểm danh học sinh vào ngày `date` nếu: đã nghỉ học, hoặc có lượt bảo lưu phủ ngày đó.
 * Học sinh trạng thái bảo lưu nhưng chưa có lượt bảo lưu nào (dữ liệu cũ) thì coi như bảo lưu mọi ngày.
 */
export function isAway(status: string, reservations: ReservationLite[], date: string): boolean {
  if (status === "QUIT") return true;
  if (reservations.some((r) => reservationCovers(r, date))) return true;
  return status === "RESERVED" && reservations.length === 0;
}

/**
 * Học sinh phải điểm danh ở buổi: đang trong lớp vào ngày đó (trừ bảo lưu, đã nghỉ),
 * cộng học sinh được xếp học bù vào buổi, cộng ai đã có điểm danh dù sau đó rời lớp.
 */
export async function rosterFor(tx: Tx, s: SessionWithClass): Promise<RosterRow[]> {
  const studentSelect = { id: true, code: true, fullName: true, englishName: true, status: true, center: { select: { color: true } } } as const;
  const [enrollments, makeups, existing] = await Promise.all([
    tx.classEnrollment.findMany({
      where: { classId: s.classId, joinedAt: { lte: s.date }, OR: [{ leftAt: null }, { leftAt: { gt: s.date } }] },
      include: { student: { select: studentSelect } },
    }),
    tx.makeup.findMany({
      where: { sessionId: s.id },
      include: {
        student: { select: studentSelect },
        absence: { select: { enrollmentId: true, session: { select: { date: true, class: { select: { code: true } } } } } },
      },
    }),
    tx.attendance.findMany({ where: { sessionId: s.id }, include: { student: { select: studentSelect } } }),
  ]);
  const reservations = await tx.reservation.findMany({
    where: { studentId: { in: enrollments.map((e) => e.studentId) } },
    select: { studentId: true, startDate: true, returnedAt: true },
  });
  const byStudent = new Map(existing.map((a) => [a.studentId, a]));
  const rows = new Map<number, Omit<RosterRow, "balance">>();
  type Stu = (typeof enrollments)[number]["student"];
  const base = (st: Stu, enrollmentId: number) => {
    const a = byStudent.get(st.id);
    return {
      studentId: st.id,
      enrollmentId,
      code: st.code,
      fullName: st.fullName,
      englishName: st.englishName,
      centerColor: st.center.color,
      status: a?.status ?? null,
      comment: a?.comment ?? null,
    };
  };
  for (const e of enrollments) {
    if (!byStudent.has(e.studentId) && isAway(e.student.status, reservations.filter((r) => r.studentId === e.studentId), s.date)) continue;
    rows.set(e.studentId, { ...base(e.student, e.id), makeup: null });
  }
  for (const m of makeups) {
    rows.set(m.studentId, {
      ...base(m.student, m.absence.enrollmentId),
      makeup: { id: m.id, fromClassCode: m.absence.session.class.code, fromDate: m.absence.session.date },
    });
  }
  // Đã điểm danh rồi nhưng không còn trong danh sách (rời lớp, đổi lịch học bù): vẫn hiện để không mất dữ liệu.
  for (const a of existing) {
    if (!rows.has(a.studentId)) rows.set(a.studentId, { ...base(a.student, a.enrollmentId), makeup: null });
  }
  const balances = await balancesFor(tx, [...new Set([...rows.values()].map((r) => r.enrollmentId))]);
  return [...rows.values()]
    .map((r) => ({ ...r, balance: balances.get(r.enrollmentId) ?? null }))
    .sort((a, b) => Number(!!a.makeup) - Number(!!b.makeup) || a.fullName.localeCompare(b.fullName, "vi"));
}
