import { diff, logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { body, idParam, notFound, route, type IdCtx } from "@/server/http";
import { teacherSearchText } from "@/server/search-text";
import { teacherSchema } from "@/server/validators";
import { addDays, startOfWeek, todayISO } from "@/lib/dates";

export const GET = route<IdCtx>(async (req, { params }) => {
  const id = idParam((await params).id);
  const weekStart = new URL(req.url).searchParams.get("week") ?? startOfWeek(todayISO());
  const t = await prisma.teacher.findUnique({
    where: { id },
    include: {
      centers: { include: { center: { select: { id: true, name: true, color: true } } } },
      mainClasses: {
        include: { center: { select: { name: true, color: true } }, room: { select: { name: true } } },
        orderBy: { startDate: "desc" },
      },
      assistantIn: {
        include: {
          class: { include: { center: { select: { name: true, color: true } }, room: { select: { name: true } } } },
        },
      },
    },
  });
  if (!t) throw notFound("Không tìm thấy giáo viên");
  const weekEnd = addDays(weekStart, 6);
  const assistantClassIds = t.assistantIn.map((a) => a.classId);
  const week = await prisma.classSession.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnd },
      OR: [{ teacherId: id }, { classId: { in: assistantClassIds } }],
    },
    include: {
      class: { select: { id: true, code: true, name: true, center: { select: { name: true, color: true } } } },
      room: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return { ...t, weekStart, week };
});

export const PUT = route<IdCtx>(async (req, { params }) => {
  const id = idParam((await params).id);
  const { centerIds, ...data } = await body(req, teacherSchema);
  return prisma.$transaction(async (tx) => {
    const before = await tx.teacher.findUnique({ where: { id }, include: { centers: true } });
    if (!before) throw notFound("Không tìm thấy giáo viên");
    await tx.teacherCenter.deleteMany({ where: { teacherId: id } });
    const after = await tx.teacher.update({
      where: { id },
      data: {
        ...data,
        searchText: teacherSearchText({ ...data, code: before.code }),
        centers: { create: centerIds.map((centerId) => ({ centerId })) },
      },
    });
    await logChange(tx, "Teacher", id, "update", {
      ...diff(before, after, Object.keys(data)),
      ...diff(
        { centerIds: before.centers.map((c) => c.centerId).sort() },
        { centerIds: [...centerIds].sort() },
      ),
    });
    return after;
  });
});
