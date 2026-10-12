import { canManageSettings } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { allow, body, conflict, route } from "@/server/http";
import { roomSchema } from "@/server/validators";

export const POST = route(async (req, _ctx, viewer) => {
  allow(canManageSettings(viewer));
  const data = await body(req, roomSchema);
  const dup = await prisma.room.findUnique({ where: { centerId_name: { centerId: data.centerId, name: data.name } } });
  if (dup) throw conflict(`Trung tâm này đã có phòng ${data.name}`);
  return prisma.room.create({ data });
});
