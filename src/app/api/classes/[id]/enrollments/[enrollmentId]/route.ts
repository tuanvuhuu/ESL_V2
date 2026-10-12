import { todayISO } from "@/lib/dates";
import { logChange } from "@/server/audit";
import { assertCanEditClass } from "@/server/access";
import { prisma } from "@/server/db";
import { badRequest, idParam, notFound, route } from "@/server/http";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

/** Cho học sinh rời lớp: giữ lại bản ghi, chỉ đặt ngày rời. */
export const DELETE = route<Ctx>(async (_req, { params }, viewer) => {
  const p = await params;
  const classId = idParam(p.id);
  const enrollmentId = idParam(p.enrollmentId);
  return prisma.$transaction(async (tx) => {
    await assertCanEditClass(tx, viewer, classId);
    const e = await tx.classEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true, class: true },
    });
    if (!e || e.classId !== classId) throw notFound();
    if (e.leftAt) throw badRequest("Học sinh đã rời lớp");
    await tx.classEnrollment.update({ where: { id: enrollmentId }, data: { leftAt: todayISO() } });
    await logChange(tx, "Student", e.studentId, "leave", { class: [e.class.code, null] });
    await logChange(tx, "Class", classId, "leave", { student: [e.student.fullName, null] });
  });
});
