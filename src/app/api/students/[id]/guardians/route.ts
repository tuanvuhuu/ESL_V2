import { z } from "zod";
import { assertCanEditStudent } from "@/server/access";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { badRequest, body, idParam, route, type IdCtx } from "@/server/http";
import { refreshParentSearch, refreshStudentSearch } from "@/server/search-text";
import { guardianLinkSchema } from "@/server/validators";

/** Gắn thêm phụ huynh (tối đa 2 người giám hộ / học sinh). */
export const POST = route<IdCtx>(async (req, { params }, viewer) => {
  const studentId = idParam((await params).id);
  const data = await body(req, guardianLinkSchema);
  return prisma.$transaction(async (tx) => {
    await assertCanEditStudent(tx, viewer, studentId);
    const count = await tx.studentGuardian.count({ where: { studentId } });
    if (count >= 2) throw badRequest("Mỗi học sinh tối đa 2 người giám hộ");
    if (data.isPrimary) await tx.studentGuardian.updateMany({ where: { studentId }, data: { isPrimary: false } });
    if (data.isPayer) await tx.studentGuardian.updateMany({ where: { studentId }, data: { isPayer: false } });
    const g = await tx.studentGuardian.create({ data: { studentId, ...data } });
    await refreshParentSearch(tx, data.parentId);
    await logChange(tx, "Student", studentId, "guardian-add", { parentId: [null, data.parentId] });
    return g;
  });
});

/** Gỡ phụ huynh khỏi học sinh (phải còn ít nhất 1 người). */
export const DELETE = route<IdCtx>(async (req, { params }, viewer) => {
  const studentId = idParam((await params).id);
  const { parentId } = await body(req, z.object({ parentId: z.number().int().positive() }));
  return prisma.$transaction(async (tx) => {
    await assertCanEditStudent(tx, viewer, studentId);
    const count = await tx.studentGuardian.count({ where: { studentId } });
    if (count <= 1) throw badRequest("Học sinh phải có ít nhất 1 phụ huynh");
    const removed = await tx.studentGuardian.delete({ where: { studentId_parentId: { studentId, parentId } } });
    if (removed.isPrimary) {
      const other = await tx.studentGuardian.findFirst({ where: { studentId } });
      if (other) await tx.studentGuardian.update({ where: { id: other.id }, data: { isPrimary: true } });
    }
    await refreshParentSearch(tx, parentId);
    await refreshStudentSearch(tx, studentId);
    await logChange(tx, "Student", studentId, "guardian-remove", { parentId: [parentId, null] });
  });
});
