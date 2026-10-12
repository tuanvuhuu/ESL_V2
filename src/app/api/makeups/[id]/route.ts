import { canEditCenter } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { allow, badRequest, idParam, notFound, route, type IdCtx } from "@/server/http";

/** Bỏ lịch học bù chưa điểm danh. */
export const DELETE = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  return prisma.$transaction(async (tx) => {
    const m = await tx.makeup.findUnique({
      where: { id },
      include: { student: { select: { centerId: true } }, attendance: true, session: { select: { date: true, class: { select: { code: true } } } } },
    });
    if (!m) throw notFound("Không tìm thấy lịch học bù");
    allow(canEditCenter(viewer, m.student.centerId), "Chỉ sửa được học bù của học sinh trung tâm mình");
    if (m.attendance) throw badRequest("Buổi học bù đã điểm danh, không bỏ được");
    await tx.makeup.delete({ where: { id } });
    await logChange(tx, "Student", m.studentId, "makeup-remove", { session: [`${m.session.date.split("-").reverse().join("/")} · ${m.session.class.code}`, null] });
  });
});
