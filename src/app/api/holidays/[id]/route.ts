import { canManageSettings } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { idParam, allow, route, type IdCtx } from "@/server/http";

export const DELETE = route<IdCtx>(async (_req, { params }, viewer) => {
  allow(canManageSettings(viewer));
  const id = idParam((await params).id);
  await prisma.holiday.delete({ where: { id } });
});
