import { prisma } from "@/server/db";
import { body, conflict, route } from "@/server/http";
import { roomSchema } from "@/server/validators";

export const POST = route(async (req) => {
  const data = await body(req, roomSchema);
  const dup = await prisma.room.findUnique({ where: { centerId_name: { centerId: data.centerId, name: data.name } } });
  if (dup) throw conflict(`Trung tâm này đã có phòng ${data.name}`);
  return prisma.room.create({ data });
});
