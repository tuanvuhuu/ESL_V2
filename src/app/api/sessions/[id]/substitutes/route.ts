import { canEditCenter } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { allow, idParam, notFound, route, type IdCtx } from "@/server/http";
import { substituteCandidates } from "@/server/staffing";

/** Gợi ý người dạy thay cho một buổi: rảnh / ngoài lịch rảnh / đang nghỉ / trùng giờ, đã dạy khóa này chưa. */
export const GET = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  const s = await prisma.classSession.findUnique({ where: { id }, select: { class: { select: { centerId: true } } } });
  if (!s) throw notFound("Không tìm thấy buổi học");
  allow(canEditCenter(viewer, s.class.centerId), "Chỉ xếp dạy thay được cho buổi của trung tâm mình");
  return substituteCandidates(prisma, id);
});
