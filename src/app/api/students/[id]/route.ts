import { assertCanEditStudent, assertCanViewStudent, redactParent } from "@/server/access";
import { diff, logChange } from "@/server/audit";
import { balancesFor } from "@/server/attendance";
import { prisma } from "@/server/db";
import { body, idParam, notFound, route, type IdCtx } from "@/server/http";
import { refreshStudentSearch } from "@/server/search-text";
import { studentSchema } from "@/server/validators";
import { todayISO } from "@/lib/dates";

export const GET = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  await assertCanViewStudent(viewer, id);
  const s = await prisma.student.findUnique({
    where: { id },
    include: {
      center: true,
      guardians: {
        include: {
          parent: {
            include: {
              children: {
                where: { studentId: { not: id } },
                include: { student: { select: { id: true, code: true, fullName: true, status: true } } },
              },
            },
          },
        },
        orderBy: { isPrimary: "desc" },
      },
      enrollments: {
        include: {
          class: {
            include: {
              center: { select: { name: true, color: true } },
              teacher: { select: { displayName: true } },
              course: { select: { name: true } },
            },
          },
          attendances: {
            include: {
              session: { select: { id: true, index: true, date: true, startTime: true, endTime: true, lessonContent: true, class: { select: { code: true } } } },
              makeup: { select: { absence: { select: { status: true, session: { select: { date: true } } } } } },
              makeupFor: { select: { id: true, session: { select: { date: true, startTime: true, class: { select: { code: true } } } }, attendance: { select: { status: true } } } },
            },
            orderBy: { session: { date: "asc" } },
          },
        },
        orderBy: { joinedAt: "desc" },
      },
    },
  });
  if (!s) throw notFound("Không tìm thấy học sinh");

  // Lịch 2 tuần tới của các lớp đang theo học.
  const activeClassIds = s.enrollments.filter((e) => !e.leftAt).map((e) => e.classId);
  const today = todayISO();
  const upcoming = await prisma.classSession.findMany({
    where: { classId: { in: activeClassIds }, date: { gte: today } },
    include: { class: { select: { code: true, name: true } }, room: { select: { name: true } }, teacher: { select: { displayName: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 20,
  });
  const balances = await balancesFor(prisma, s.enrollments.map((e) => e.id));
  // Buổi học bù sắp tới cũng hiện trong lịch.
  const makeupSessions = await prisma.classSession.findMany({
    where: { date: { gte: today }, makeups: { some: { studentId: id } } },
    include: { class: { select: { code: true, name: true } }, room: { select: { name: true } }, teacher: { select: { displayName: true } } },
  });
  const allUpcoming = [...upcoming.map((u) => ({ ...u, makeup: false })), ...makeupSessions.map((u) => ({ ...u, makeup: true }))]
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 20);
  return {
    ...s,
    enrollments: s.enrollments.map((e) => ({ ...e, balance: balances.get(e.id) ?? null })),
    upcoming: allUpcoming,
    guardians: s.guardians.map((g) => ({ ...g, parent: redactParent(viewer, g.parent) })),
  };
});

export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const data = await body(req, studentSchema);
  return prisma.$transaction(async (tx) => {
    await assertCanEditStudent(tx, viewer, id);
    const before = await tx.student.findUnique({ where: { id } });
    if (!before) throw notFound("Không tìm thấy học sinh");
    const after = await tx.student.update({ where: { id }, data });
    await refreshStudentSearch(tx, id);
    await logChange(tx, "Student", id, "update", diff(before, after, Object.keys(data)));
    return after;
  });
});
