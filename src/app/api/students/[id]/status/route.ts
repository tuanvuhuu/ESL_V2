import { assertCanEditStudent } from "@/server/access";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { body, idParam, notFound, route, type IdCtx } from "@/server/http";
import { statusChangeSchema } from "@/server/validators";

export const POST = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const { status, reason, note } = await body(req, statusChangeSchema);
  return prisma.$transaction(async (tx) => {
    await assertCanEditStudent(tx, viewer, id);
    const before = await tx.student.findUnique({ where: { id } });
    if (!before) throw notFound("Không tìm thấy học sinh");
    const after = await tx.student.update({
      where: { id },
      data: { status, statusReason: status === "QUIT" ? reason : null },
    });
    await logChange(tx, "Student", id, "status", {
      status: [before.status, status],
      ...(reason ? { reason: [null, reason] } : {}),
      ...(note ? { note: [null, note] } : {}),
    });
    return after;
  });
});
