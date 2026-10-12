import { prisma } from "@/server/db";
import { idParam, route, type IdCtx } from "@/server/http";

export const DELETE = route<IdCtx>(async (_req, { params }) => {
  const id = idParam((await params).id);
  await prisma.holiday.delete({ where: { id } });
});
