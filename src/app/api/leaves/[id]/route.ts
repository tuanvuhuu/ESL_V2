import { formatDateVN, todayISO } from "@/lib/dates";
import { isStaff } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { badRequest, idParam, notFound, route, type IdCtx } from "@/server/http";
import { assertCanManageTime, loadTeacherForTime } from "@/server/staffing";

/** Hủy đăng ký nghỉ. Người dạy thay đã xếp vẫn giữ nguyên, đổi lại ở từng buổi nếu cần. */
export const DELETE = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  return prisma.$transaction(async (tx) => {
    const leave = await tx.teacherLeave.findUnique({ where: { id } });
    if (!leave) throw notFound("Không tìm thấy ngày nghỉ");
    const t = await loadTeacherForTime(tx, viewer, leave.teacherId);
    assertCanManageTime(viewer, t);
    if (isStaff(viewer) && leave.toDate < todayISO()) throw badRequest("Ngày nghỉ đã qua, không hủy được");
    await tx.teacherLeave.delete({ where: { id } });
    await logChange(tx, "Teacher", leave.teacherId, "leave-remove", { leave: [`${formatDateVN(leave.fromDate)}–${formatDateVN(leave.toDate)}`, null] });
  });
});
