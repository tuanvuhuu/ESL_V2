import { prisma } from "@/server/db";
import { body, route } from "@/server/http";
import { holidaySchema } from "@/server/validators";

export const GET = route(async () =>
  prisma.holiday.findMany({ orderBy: { date: "asc" }, include: { center: { select: { name: true } } } }),
);

export const POST = route(async (req) => {
  const data = await body(req, holidaySchema);
  return prisma.holiday.create({ data: { ...data, centerId: data.centerId ?? null } });
});
