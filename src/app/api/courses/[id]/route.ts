import { canManageSettings } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { allow, badRequest, body, idParam, route, type IdCtx } from "@/server/http";
import { courseSchema } from "@/server/validators";

export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  allow(canManageSettings(viewer));
  const id = idParam((await params).id);
  const data = await body(req, courseSchema);
  if (data.nextCourseId === id) throw badRequest("Khóa tiếp theo phải khác khóa này");
  return prisma.course.update({ where: { id }, data });
});
