import { optionOf, COURSE_OUTCOMES } from "@/lib/constants";
import { canWriteOutcome } from "@/lib/permissions";
import { diff, logChange } from "@/server/audit";
import { currentActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { allow, body, idParam, notFound, route } from "@/server/http";
import { outcomeSchema } from "@/server/validators";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

/** Ghi kết quả cuối khóa và nhận xét tổng kết cho một học sinh trong lớp. */
export const PUT = route<Ctx>(async (req, { params }, viewer) => {
  const p = await params;
  const classId = idParam(p.id);
  const enrollmentId = idParam(p.enrollmentId);
  const data = await body(req, outcomeSchema);
  return prisma.$transaction(async (tx) => {
    const before = await tx.classEnrollment.findUnique({ where: { id: enrollmentId }, include: { class: true } });
    if (!before || before.classId !== classId) throw notFound("Không tìm thấy ghi danh");
    allow(canWriteOutcome(viewer, before.class.centerId, before.class.teacherId), "Chỉ giáo viên chính của lớp hoặc giáo vụ trung tâm ghi được kết quả");
    const cleared = !data.outcome && !data.finalComment;
    const after = await tx.classEnrollment.update({
      where: { id: enrollmentId },
      data: {
        outcome: data.outcome ?? null,
        finalComment: data.finalComment,
        outcomeBy: cleared ? null : currentActor(),
        outcomeAt: cleared ? null : new Date(),
      },
    });
    const label = (v: string | null) => optionOf(COURSE_OUTCOMES, v)?.label ?? v;
    const changes = diff({ ...before, outcome: label(before.outcome) }, { ...after, outcome: label(after.outcome) }, ["outcome", "finalComment"]);
    if (Object.keys(changes).length) await logChange(tx, "Student", before.studentId, "outcome", { class: [before.class.code, before.class.code], ...changes });
    return after;
  });
});
