import { canManageSettings } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { allow, body, idParam, route, type IdCtx } from "@/server/http";
import { courseSchema } from "@/server/validators";

export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  allow(canManageSettings(viewer));
  const id = idParam((await params).id);
  const data = await body(req, courseSchema);
  return prisma.course.update({ where: { id }, data });
});
