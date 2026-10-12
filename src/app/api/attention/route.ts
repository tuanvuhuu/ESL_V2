import { LOW_BALANCE, isAbsent } from "@/lib/attendance";
import { inRange } from "@/lib/availability";
import { addDays, todayISO } from "@/lib/dates";
import { canArrangeMakeups } from "@/lib/permissions";
import { balancesFor } from "@/server/attendance";
import { prisma } from "@/server/db";
import { allow, route } from "@/server/http";
import { syncClassStatuses } from "@/server/lifecycle";

/**
 * Danh sách cần chú ý ở Tổng quan hôm nay (M2): sắp hết / hết buổi, vắng nhiều, buổi chưa điểm danh, vắng chưa bù,
 * buổi 14 ngày tới của người đang nghỉ chưa có người dạy thay, bảo lưu sắp / đã đến ngày quay lại.
 */
export const GET = route(async (req, _ctx, viewer) => {
  allow(canArrangeMakeups(viewer));
  await syncClassStatuses();
  const centerId = Number(new URL(req.url).searchParams.get("centerId")) || undefined;
  const today = todayISO();
  const classWhere = centerId ? { centerId } : {};
  const [enrollments, notTaken, recentAbsences, pendingMakeups] = await Promise.all([
    prisma.classEnrollment.findMany({
      where: { leftAt: null, class: { ...classWhere, status: { in: ["ACTIVE", "SUSPENDED"] } }, student: { status: "STUDYING" } },
      include: {
        student: { select: { id: true, code: true, fullName: true, center: { select: { name: true, color: true } } } },
        class: { select: { id: true, code: true } },
      },
    }),
    prisma.classSession.findMany({
      where: { status: "SCHEDULED", attendanceTakenAt: null, date: { gte: addDays(today, -14), lte: today }, class: classWhere },
      include: { class: { select: { id: true, code: true, center: { select: { name: true, color: true } } } }, teacher: { select: { displayName: true } } },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
    prisma.attendance.findMany({
      where: { status: { in: ["EXCUSED", "UNEXCUSED"] }, session: { date: { gte: addDays(today, -30) } }, student: centerId ? { centerId } : {} },
      select: { status: true, student: { select: { id: true, code: true, fullName: true, status: true, center: { select: { name: true, color: true } } } } },
    }),
    prisma.attendance.count({
      where: {
        status: { in: ["EXCUSED", "UNEXCUSED"] },
        makeupId: null,
        makeupFor: { is: null },
        session: { date: { gte: addDays(today, -60) } },
        student: { status: { not: "QUIT" }, ...(centerId ? { centerId } : {}) },
      },
    }),
  ]);
  const [leaves, reservationsDue, followUpsDue, finished] = await Promise.all([
    prisma.teacherLeave.findMany({
      where: { fromDate: { lte: addDays(today, 14) }, toDate: { gte: today } },
      include: { teacher: { select: { id: true, displayName: true } } },
    }),
    prisma.reservation.findMany({
      where: { returnedAt: null, expectedReturn: { lte: addDays(today, 7) }, student: centerId ? { centerId } : {} },
      include: { student: { select: { id: true, code: true, fullName: true, center: { select: { name: true, color: true } } } } },
      orderBy: { expectedReturn: "asc" },
    }),
    prisma.contactLog.count({ where: { followUpDate: { lte: today }, followUpDoneAt: null, student: centerId ? { centerId } : {} } }),
    // Lớp kết thúc trong 45 ngày qua: học sinh chưa có lớp tiếp theo cần tư vấn khóa mới (L8).
    prisma.classEnrollment.findMany({
      where: {
        leftAt: null,
        class: { ...classWhere, status: "FINISHED", sessions: { some: { status: "SCHEDULED", date: { gte: addDays(today, -45) } } } },
        student: {
          status: { in: ["STUDYING", "FINISHED", "WAITING"] },
          waitingCourseId: null,
          enrollments: { none: { leftAt: null, class: { status: { in: ["PLANNED", "ACTIVE", "SUSPENDED"] } } } },
        },
      },
      include: {
        student: { select: { id: true, code: true, fullName: true, center: { select: { name: true, color: true } } } },
        class: { select: { id: true, code: true, course: { select: { name: true } } } },
      },
      orderBy: { classId: "asc" },
    }),
  ]);
  const leaveSessions = leaves.length
    ? await prisma.classSession.findMany({
        where: {
          status: "SCHEDULED",
          date: { gte: today, lte: addDays(today, 14) },
          teacherId: { in: leaves.map((l) => l.teacherId) },
          class: classWhere,
        },
        include: { class: { select: { id: true, code: true, centerId: true, center: { select: { name: true, color: true } } } }, teacher: { select: { displayName: true } } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      })
    : [];
  const needSubstitute = leaveSessions
    .map((s) => ({ ...s, leave: leaves.find((l) => l.teacherId === s.teacherId && inRange(l, s.date)) }))
    .filter((s) => s.leave)
    .map(({ leave, ...s }) => ({ ...s, leaveReason: leave!.reason }));
  const balances = await balancesFor(prisma, enrollments.map((e) => e.id));
  const low = enrollments
    .map((e) => ({ enrollmentId: e.id, student: e.student, class: e.class, balance: balances.get(e.id)! }))
    .filter((e) => e.balance && e.balance.remaining <= LOW_BALANCE)
    .sort((a, b) => a.balance.remaining - b.balance.remaining);
  // Buổi hôm nay chỉ tính "chưa điểm danh" khi đã qua giờ kết thúc (giờ Việt Nam).
  const now = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
  const pastNotTaken = notTaken.filter((s) => s.date < today || s.endTime <= now);
  const absenceCount = new Map<number, { student: (typeof recentAbsences)[number]["student"]; count: number }>();
  for (const a of recentAbsences) {
    if (!isAbsent(a.status) || a.student.status === "QUIT") continue;
    const cur = absenceCount.get(a.student.id) ?? { student: a.student, count: 0 };
    cur.count++;
    absenceCount.set(a.student.id, cur);
  }
  return {
    lowBalance: low.filter((e) => e.balance.remaining > 0),
    exhausted: low.filter((e) => e.balance.remaining <= 0),
    frequentAbsences: [...absenceCount.values()].filter((x) => x.count >= 3).sort((a, b) => b.count - a.count),
    notTaken: pastNotTaken.slice(0, 30),
    notTakenCount: pastNotTaken.length,
    pendingMakeups,
    needSubstitute,
    reservationsDue,
    followUpsDue,
    toAdvise: finished.map((e) => ({ enrollmentId: e.id, student: e.student, class: e.class, outcome: e.outcome })),
  };
});
