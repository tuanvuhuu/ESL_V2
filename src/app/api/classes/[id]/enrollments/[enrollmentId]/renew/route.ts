import { applyRenewal } from "@/lib/finance";
import { canManageFinance } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { allow, badRequest, body, idParam, notFound, route } from "@/server/http";
import { renewSchema } from "@/server/validators";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

/** Mua thêm buổi (gia hạn) cho ghi danh đang học: cộng số buổi và học phí; phần chưa đóng thành công nợ. */
export const POST = route<Ctx>(async (req, { params }, viewer) => {
  const p = await params;
  const classId = idParam(p.id);
  const enrollmentId = idParam(p.enrollmentId);
  const input = await body(req, renewSchema);
  return prisma.$transaction(async (tx) => {
    const e = await tx.classEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { class: { select: { code: true, centerId: true, totalSessions: true, course: { select: { tuition: true } } } } },
    });
    if (!e || e.classId !== classId) throw notFound("Không tìm thấy ghi danh");
    allow(canManageFinance(viewer, e.class.centerId), "Chỉ giáo vụ trung tâm của lớp hoặc quản lý được bán thêm buổi");
    if (e.leftAt) throw badRequest("Học sinh đã rời lớp này, không mua thêm buổi được");
    const before = { tuitionFee: e.tuitionFee ?? e.class.course?.tuition ?? 0, purchasedSessions: e.purchasedSessions ?? e.class.totalSessions };
    const after = applyRenewal(before, { sessions: input.sessions, amount: input.amount });
    const updated = await tx.classEnrollment.update({
      where: { id: enrollmentId },
      data: { ...after, ...(input.dueDate ? { dueDate: input.dueDate } : {}) },
    });
    await logChange(tx, "Student", e.studentId, "renew", {
      class: [e.class.code, e.class.code],
      purchasedSessions: [before.purchasedSessions, after.purchasedSessions],
      tuitionFee: [before.tuitionFee, after.tuitionFee],
      ...(input.dueDate && input.dueDate !== e.dueDate ? { dueDate: [e.dueDate, input.dueDate] } : {}),
      ...(input.note ? { note: [null, input.note] } : {}),
    });
    return updated;
  });
});
