import { prisma } from "@/server/db";
import { transferEnrollment } from "@/server/enrollments";
import { body, idParam, notFound, route } from "@/server/http";
import { transferSchema } from "@/server/validators";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

/** Chuyển lớp, chuyển trung tâm: số buổi còn lại đi theo học sinh. */
export const POST = route<Ctx>(async (req, { params }, viewer) => {
  const p = await params;
  const classId = idParam(p.id);
  const enrollmentId = idParam(p.enrollmentId);
  const input = await body(req, transferSchema);
  return prisma.$transaction(async (tx) => {
    const e = await tx.classEnrollment.findUnique({ where: { id: enrollmentId }, select: { classId: true } });
    if (!e || e.classId !== classId) throw notFound("Không tìm thấy ghi danh");
    return transferEnrollment(tx, viewer, { enrollmentId, ...input });
  });
});
