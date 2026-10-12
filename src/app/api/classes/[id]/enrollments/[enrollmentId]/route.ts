import { todayISO } from "@/lib/dates";
import { diff, logChange } from "@/server/audit";
import { assertCanEditClass } from "@/server/access";
import { prisma } from "@/server/db";
import { badRequest, body, idParam, notFound, route } from "@/server/http";
import { enrollmentUpdateSchema } from "@/server/validators";

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

/** Sửa số buổi đã mua và điều chỉnh tay (tặng buổi, chuyển buổi từ khóa trước…). */
export const PATCH = route<Ctx>(async (req, { params }, viewer) => {
  const p = await params;
  const classId = idParam(p.id);
  const enrollmentId = idParam(p.enrollmentId);
  const data = await body(req, enrollmentUpdateSchema);
  return prisma.$transaction(async (tx) => {
    await assertCanEditClass(tx, viewer, classId);
    const before = await tx.classEnrollment.findUnique({ where: { id: enrollmentId }, include: { class: true } });
    if (!before || before.classId !== classId) throw notFound();
    const after = await tx.classEnrollment.update({ where: { id: enrollmentId }, data });
    const changes = diff(
      { ...before, purchasedSessions: before.purchasedSessions ?? before.class.totalSessions },
      after,
      ["purchasedSessions", "adjustment", "adjustmentNote"],
    );
    if (Object.keys(changes).length > 0) {
      await logChange(tx, "Student", before.studentId, "sessions", { class: [before.class.code, before.class.code], ...changes });
    }
    return after;
  });
});
