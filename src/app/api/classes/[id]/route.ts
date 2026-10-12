import { todayISO } from "@/lib/dates";
import { findConflicts } from "@/lib/schedule";
import { diff, logChange } from "@/server/audit";
import { validateRefs } from "@/server/classes";
import { prisma } from "@/server/db";
import { body, conflict, idParam, notFound, route, type IdCtx } from "@/server/http";
import { loadSlots, toSlot } from "@/server/slots";
import { classUpdateSchema } from "@/server/validators";

export const GET = route<IdCtx>(async (_req, { params }) => {
  const id = idParam((await params).id);
  const cls = await prisma.classGroup.findUnique({
    where: { id },
    include: {
      center: true,
      room: true,
      course: true,
      teacher: { select: { id: true, displayName: true, fullName: true } },
      assistants: { include: { teacher: { select: { id: true, displayName: true } } } },
      sessions: {
        include: { room: { select: { name: true } }, teacher: { select: { id: true, displayName: true } } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
      enrollments: {
        include: { student: { select: { id: true, code: true, fullName: true, englishName: true, status: true, dob: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!cls) throw notFound("Không tìm thấy lớp");
  return cls;
});

export const PUT = route<IdCtx>(async (req, { params }) => {
  const id = idParam((await params).id);
  const data = await body(req, classUpdateSchema);
  return prisma.$transaction(async (tx) => {
    const before = await tx.classGroup.findUnique({ where: { id }, include: { assistants: true } });
    if (!before) throw notFound("Không tìm thấy lớp");
    const { assistantIds, ...fields } = data;
    const today = todayISO();

    if (assistantIds) {
      await validateRefs(tx, { ...before, assistantIds });
      await tx.classAssistant.deleteMany({ where: { classId: id } });
      await tx.classAssistant.createMany({ data: assistantIds.map((teacherId) => ({ classId: id, teacherId })) });
      // Trợ giảng mới phải rảnh ở các buổi sắp tới.
      const future = await tx.classSession.findMany({
        where: { classId: id, date: { gte: today }, status: "SCHEDULED" },
        include: { room: true, class: { include: { center: true, assistants: true } } },
      });
      const candidates = future.map(toSlot);
      const existing = await loadSlots(tx, candidates.map((c) => c.date));
      const staff = await tx.teacher.findMany({ where: { id: { in: assistantIds } } });
      const found = findConflicts(candidates, existing, Object.fromEntries(staff.map((s) => [s.id, s.displayName])));
      if (found.length > 0) throw conflict(`Không thể lưu: ${found[0].message}`, found.map((c) => c.message));
    }

    const after = await tx.classGroup.update({ where: { id }, data: fields });
    if (fields.status === "CANCELLED" && before.status !== "CANCELLED") {
      await tx.classSession.updateMany({
        where: { classId: id, date: { gte: today }, status: "SCHEDULED" },
        data: { status: "CANCELLED", note: "Lớp đã hủy" },
      });
    }
    await logChange(tx, "Class", id, "update", {
      ...diff(before, after, Object.keys(fields)),
      ...(assistantIds
        ? diff({ assistantIds: before.assistants.map((a) => a.teacherId).sort() }, { assistantIds: [...assistantIds].sort() })
        : {}),
    });
    return after;
  });
});
