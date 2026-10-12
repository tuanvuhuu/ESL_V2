import { rangesOverlap } from "@/lib/availability";
import { formatDateVN, todayISO } from "@/lib/dates";
import { isStaff } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { currentActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { badRequest, body, conflict, idParam, route, type IdCtx } from "@/server/http";
import { affectedSessions, assertCanManageTime, loadTeacherForTime } from "@/server/staffing";
import { leaveSchema } from "@/server/validators";

/** Ngày nghỉ của một người, mỗi lần nghỉ kèm các buổi bị ảnh hưởng. */
export const GET = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  await loadTeacherForTime(prisma, viewer, id);
  const leaves = await prisma.teacherLeave.findMany({ where: { teacherId: id }, orderBy: { fromDate: "desc" }, take: 50 });
  return Promise.all(leaves.map(async (l) => ({ ...l, affected: await affectedSessions(prisma, id, l.fromDate, l.toDate) })));
});

/** Đăng ký nghỉ (không cần duyệt). Trả về các buổi bị ảnh hưởng để xếp người dạy thay. */
export const POST = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const input = await body(req, leaveSchema);
  return prisma.$transaction(async (tx) => {
    const t = await loadTeacherForTime(tx, viewer, id);
    assertCanManageTime(viewer, t);
    if (isStaff(viewer) && input.fromDate < todayISO()) throw badRequest("Chỉ đăng ký nghỉ được từ hôm nay trở đi. Ngày đã qua nhờ giáo vụ ghi giúp.");
    const existing = await tx.teacherLeave.findMany({ where: { teacherId: id, toDate: { gte: input.fromDate } } });
    const clash = existing.find((l) => rangesOverlap(l, input));
    if (clash) {
      throw conflict(`Không thể lưu: ${t.displayName} đã đăng ký nghỉ ${formatDateVN(clash.fromDate)}–${formatDateVN(clash.toDate)}. Sửa lại khoảng ngày.`);
    }
    const leave = await tx.teacherLeave.create({ data: { ...input, teacherId: id, createdBy: currentActor() } });
    await logChange(tx, "Teacher", id, "leave-add", { leave: [null, `${formatDateVN(input.fromDate)}–${formatDateVN(input.toDate)}`], reason: [null, input.reason] });
    return { ...leave, affected: await affectedSessions(tx, id, leave.fromDate, leave.toDate) };
  });
});
