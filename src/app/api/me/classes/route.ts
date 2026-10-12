import { addDays, todayISO } from "@/lib/dates";
import { isStaff } from "@/lib/permissions";
import { syncClassStatuses } from "@/server/lifecycle";
import { staffClassWhere } from "@/server/access";
import { balancesFor } from "@/server/attendance";
import { prisma } from "@/server/db";
import { allow, route } from "@/server/http";

/** Lớp của tôi (G4): học sinh đang học và chuyên cần từng em trong lớp. */
export const GET = route(async (_req, _ctx, viewer) => {
  allow(isStaff(viewer) && viewer.teacherId != null, "Trang này dành cho giáo viên, trợ giảng");
  await syncClassStatuses();
  const classes = await prisma.classGroup.findMany({
    where: {
      AND: [
        staffClassWhere(viewer),
        {
          OR: [
            { status: { in: ["PLANNED", "ACTIVE", "SUSPENDED"] } },
            // Lớp mình dạy chính vừa kết thúc trong 30 ngày: còn hiện để ghi kết quả cuối khóa.
            { status: "FINISHED", teacherId: viewer.teacherId!, sessions: { some: { status: "SCHEDULED", date: { gte: addDays(todayISO(), -30) } } } },
          ],
        },
      ],
    },
    include: {
      center: { select: { id: true, name: true, color: true } },
      room: { select: { name: true } },
      teacher: { select: { id: true, displayName: true } },
      enrollments: {
        where: { leftAt: null },
        include: { student: { select: { id: true, code: true, fullName: true, englishName: true, status: true } } },
      },
      sessions: { where: { status: "SCHEDULED" }, select: { id: true, attendanceTakenAt: true } },
    },
    orderBy: [{ startTime: "asc" }],
  });
  const enrollmentIds = classes.flatMap((c) => c.enrollments.map((e) => e.id));
  const [balances, attendance] = await Promise.all([
    balancesFor(prisma, enrollmentIds),
    prisma.attendance.groupBy({
      by: ["enrollmentId", "status"],
      where: { enrollmentId: { in: enrollmentIds }, makeupId: null },
      _count: { _all: true },
    }),
  ]);
  const stats = new Map<number, Record<string, number>>();
  for (const g of attendance) {
    const m = stats.get(g.enrollmentId) ?? {};
    m[g.status] = g._count._all;
    stats.set(g.enrollmentId, m);
  }
  return classes.map(({ sessions, enrollments, ...c }) => ({
    ...c,
    role: c.teacherId === viewer.teacherId ? "teacher" : "assistant",
    sessionsTotal: sessions.length,
    sessionsTaken: sessions.filter((s) => s.attendanceTakenAt).length,
    students: enrollments
      .map((e) => ({ ...e.student, enrollmentId: e.id, outcome: e.outcome, balance: balances.get(e.id) ?? null, attendance: stats.get(e.id) ?? {} }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")),
  }));
});
