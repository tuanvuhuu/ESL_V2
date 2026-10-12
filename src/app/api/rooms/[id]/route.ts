import { prisma } from "@/server/db";
import { body, idParam, route, type IdCtx } from "@/server/http";
import { roomSchema } from "@/server/validators";

export const PUT = route<IdCtx>(async (req, { params }) => {
  const id = idParam((await params).id);
  const data = await body(req, roomSchema);
  return prisma.room.update({ where: { id }, data });
});
