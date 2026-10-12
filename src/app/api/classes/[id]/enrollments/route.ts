import { todayISO } from "@/lib/dates";
import { logChange } from "@/server/audit";
import { assertCanEditClass } from "@/server/access";
import { assertStudentFree } from "@/server/classes";
import { prisma } from "@/server/db";
import { badRequest, body, conflict, idParam, notFound, route, type IdCtx } from "@/server/http";
import { enrollSchema } from "@/server/validators";

/** Xếp học sinh vào lớp. */
export const POST = route<IdCtx>(async (req, { params }, viewer) => {
  const classId = idParam((await params).id);
  const { studentId, joinedAt, purchasedSessions } = await body(req, enrollSchema);
  return prisma.$transaction(async (tx) => {
    await assertCanEditClass(tx, viewer, classId);
    const cls = await tx.classGroup.findUnique({ where: { id: classId }, include: { room: true } });
    if (!cls) throw notFound("Không tìm thấy lớp");
    if (cls.status === "CANCELLED" || cls.status === "FINISHED") throw badRequest("Lớp đã kết thúc hoặc đã hủy");
    const already = await tx.classEnrollment.findFirst({ where: { classId, studentId, leftAt: null } });
    if (already) throw badRequest("Học sinh đã ở trong lớp này");
    const current = await tx.classEnrollment.count({ where: { classId, leftAt: null } });
    const limit = Math.min(cls.maxStudents, cls.room.capacity);
    if (current >= limit) {
      throw conflict(
        `Không thể xếp lớp: lớp ${cls.code} đã đủ ${current}/${limit} học sinh (sĩ số tối đa ${cls.maxStudents}, phòng ${cls.room.name} chứa ${cls.room.capacity}).`,
      );
    }
    await assertStudentFree(tx, studentId, classId);
    const e = await tx.classEnrollment.create({ data: { classId, studentId, joinedAt: joinedAt ?? todayISO(), purchasedSessions: purchasedSessions ?? cls.totalSessions } });
    const student = await tx.student.findUniqueOrThrow({ where: { id: studentId } });
    if (student.status === "WAITING") {
      await tx.student.update({ where: { id: studentId }, data: { status: "STUDYING" } });
      await logChange(tx, "Student", studentId, "status", { status: ["WAITING", "STUDYING"] });
    }
    await logChange(tx, "Student", studentId, "enroll", { class: [null, cls.code], purchasedSessions: [null, e.purchasedSessions] });
    await logChange(tx, "Class", classId, "enroll", { student: [null, student.fullName] });
    return e;
  });
});
