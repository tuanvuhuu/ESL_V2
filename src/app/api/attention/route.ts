import { LOW_BALANCE, isAbsent } from "@/lib/attendance";
import { addDays, todayISO } from "@/lib/dates";
import { canArrangeMakeups } from "@/lib/permissions";
import { balancesFor } from "@/server/attendance";
import { prisma } from "@/server/db";
import { allow, route } from "@/server/http";

/** Danh sách cần chú ý ở Tổng quan hôm nay (M2): sắp hết / hết buổi, vắng nhiều, buổi chưa điểm danh, vắng chưa bù. */
export const GET = route(async (req, _ctx, viewer) => {
  allow(canArrangeMakeups(viewer));
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
  };
});
