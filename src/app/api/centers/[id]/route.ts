import { prisma } from "@/server/db";
import { body, idParam, route, type IdCtx } from "@/server/http";
import { centerSchema } from "@/server/validators";

export const PUT = route<IdCtx>(async (req, { params }) => {
  const id = idParam((await params).id);
  const data = await body(req, centerSchema);
  return prisma.center.update({ where: { id }, data });
});
