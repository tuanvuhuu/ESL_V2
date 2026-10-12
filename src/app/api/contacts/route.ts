import type { Prisma } from "@prisma/client";
import { canEditCenter, canSeeContacts } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { currentActor } from "@/server/auth";
import { contactInclude } from "@/server/contacts";
import { prisma } from "@/server/db";
import { allow, badRequest, body, notFound, route } from "@/server/http";
import { contactSchema } from "@/server/validators";

/** Nhật ký liên lạc của một học sinh (`studentId`) hoặc của cả gia đình một phụ huynh (`parentId`), mới nhất trước. */
export const GET = route(async (req, _ctx, viewer) => {
  allow(canSeeContacts(viewer));
  const sp = new URL(req.url).searchParams;
  const studentId = Number(sp.get("studentId")) || undefined;
  const parentId = Number(sp.get("parentId")) || undefined;
  if (!studentId && !parentId) throw badRequest("Chọn học sinh hoặc phụ huynh");
  const where: Prisma.ContactLogWhereInput = studentId
    ? { studentId }
    : { OR: [{ parentId }, { student: { guardians: { some: { parentId } } } }] };
  return prisma.contactLog.findMany({ where, include: contactInclude, orderBy: { createdAt: "desc" }, take: 200 });
});

/** Ghi một lần liên lạc; có thể hẹn ngày gọi lại và đóng việc cần gọi lại đang mở (`closeId`). */
export const POST = route(async (req, _ctx, viewer) => {
  const { closeId, ...input } = await body(req, contactSchema);
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: input.studentId }, include: { guardians: true } });
    if (!student) throw notFound("Không tìm thấy học sinh");
    allow(canEditCenter(viewer, student.centerId), "Chỉ ghi được liên lạc cho học sinh của trung tâm mình");
    if (input.parentId && !student.guardians.some((g) => g.parentId === input.parentId)) throw badRequest("Phụ huynh không gắn với học sinh này");
    const actor = currentActor();
    if (closeId) {
      const open = await tx.contactLog.findUnique({ where: { id: closeId } });
      if (!open || open.studentId !== student.id) throw notFound("Không tìm thấy việc cần gọi lại");
      await tx.contactLog.update({ where: { id: closeId }, data: { followUpDoneAt: new Date(), followUpDoneBy: actor } });
    }
    const log = await tx.contactLog.create({
      data: { ...input, parentId: input.parentId ?? student.guardians.find((g) => g.isPrimary)?.parentId ?? null, createdBy: actor },
      include: contactInclude,
    });
    await logChange(tx, "Student", student.id, "contact", {
      channel: [null, input.channel],
      ...(input.followUpDate ? { followUpDate: [null, input.followUpDate] } : {}),
    });
    return log;
  });
});
