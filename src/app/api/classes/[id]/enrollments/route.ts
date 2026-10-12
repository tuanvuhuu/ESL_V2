import { todayISO } from "@/lib/dates";
import { logChange } from "@/server/audit";
import { assertCanEditClass } from "@/server/access";
import { prisma } from "@/server/db";
import { createEnrollment } from "@/server/enrollments";
import { body, idParam, route, type IdCtx } from "@/server/http";
import { enrollSchema } from "@/server/validators";

/** Xếp học sinh vào lớp. */
export const POST = route<IdCtx>(async (req, { params }, viewer) => {
  const classId = idParam((await params).id);
  const { studentId, joinedAt, purchasedSessions, tuitionFee, discountType, discountMode, discountValue, dueDate } = await body(
    req,
    enrollSchema,
  );
  return prisma.$transaction(async (tx) => {
    await assertCanEditClass(tx, viewer, classId);
    const { enrollment: e, cls } = await createEnrollment(tx, {
      classId,
      studentId,
      joinedAt: joinedAt ?? todayISO(),
      purchasedSessions,
      tuitionFee,
      discountType,
      discountMode,
      discountValue,
      dueDate,
    });
    const student = await tx.student.findUniqueOrThrow({ where: { id: studentId } });
    // Đã có lớp thì không còn chờ xếp lớp nữa.
    if (student.waitingCourseId) await tx.student.update({ where: { id: studentId }, data: { waitingCourseId: null } });
    if (student.status === "WAITING") {
      await tx.student.update({ where: { id: studentId }, data: { status: "STUDYING" } });
      await logChange(tx, "Student", studentId, "status", { status: ["WAITING", "STUDYING"] });
    }
    await logChange(tx, "Student", studentId, "enroll", { class: [null, cls.code], purchasedSessions: [null, e.purchasedSessions] });
    await logChange(tx, "Class", classId, "enroll", { student: [null, student.fullName] });
    return e;
  });
});
