import { prisma } from "@/server/db";
import { route } from "@/server/http";

export const GET = route(async () =>
  prisma.center.findMany({ orderBy: { id: "asc" }, include: { rooms: { orderBy: { name: "asc" } } } }),
);
