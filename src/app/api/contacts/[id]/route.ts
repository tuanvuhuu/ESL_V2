import { canEditCenter } from "@/lib/permissions";
import { currentActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { allow, badRequest, idParam, notFound, route, type IdCtx } from "@/server/http";

/** Đánh dấu việc cần gọi lại là xong mà không cần ghi thêm (ví dụ phụ huynh đã tự liên hệ). */
export const PATCH = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  const log = await prisma.contactLog.findUnique({ where: { id }, include: { student: { select: { centerId: true } } } });
  if (!log) throw notFound("Không tìm thấy liên lạc");
  allow(canEditCenter(viewer, log.student.centerId), "Chỉ xử lý được việc của học sinh trung tâm mình");
  if (!log.followUpDate || log.followUpDoneAt) throw badRequest("Không có việc cần gọi lại đang mở");
  return prisma.contactLog.update({ where: { id }, data: { followUpDoneAt: new Date(), followUpDoneBy: currentActor() } });
});
