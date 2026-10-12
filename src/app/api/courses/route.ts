import { prisma } from "@/server/db";
import { body, route } from "@/server/http";
import { courseSchema } from "@/server/validators";

export const GET = route(async () => prisma.course.findMany({ orderBy: { name: "asc" } }));

export const POST = route(async (req) => {
  const data = await body(req, courseSchema);
  return prisma.course.create({ data });
});
