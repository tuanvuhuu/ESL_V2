import { assertCanEditStudent } from "@/server/access";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { badRequest, body, idParam, notFound, route, type IdCtx } from "@/server/http";
import { waitingSchema } from "@/server/validators";

/** Ghi danh chưa có lớp (M5): để học sinh "Chờ xếp lớp" theo khóa; mở lớp khóa đó sẽ gợi ý học sinh này. */
export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const { courseId } = await body(req, waitingSchema);
  return prisma.$transaction(async (tx) => {
    await assertCanEditStudent(tx, viewer, id);
    const before = await tx.student.findUnique({ where: { id }, include: { waitingCourse: true } });
    if (!before) throw notFound("Không tìm thấy học sinh");
    const course = courseId ? await tx.course.findUnique({ where: { id: courseId } }) : null;
    if (courseId && !course) throw badRequest("Không tìm thấy khóa học");
    if (courseId && (before.status === "QUIT" || before.status === "RESERVED")) {
      throw badRequest("Học sinh đã nghỉ hoặc đang bảo lưu: đổi trạng thái trước khi ghi danh");
    }
    // Chưa học lớp nào thì trạng thái là "Chờ xếp lớp".
    const openClasses = await tx.classEnrollment.count({ where: { studentId: id, leftAt: null, class: { status: { in: ["PLANNED", "ACTIVE", "SUSPENDED"] } } } });
    const status = courseId && openClasses === 0 && before.status !== "WAITING" ? "WAITING" : before.status;
    const after = await tx.student.update({ where: { id }, data: { waitingCourseId: courseId, status } });
    await logChange(tx, "Student", id, "waiting", {
      waitingCourse: [before.waitingCourse?.name ?? null, course?.name ?? null],
      ...(status !== before.status ? { status: [before.status, status] } : {}),
    });
    return after;
  });
});
