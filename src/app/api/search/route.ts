import { normalizeQuery } from "@/lib/text";
import { prisma } from "@/server/db";
import { route } from "@/server/http";

/** Ô tìm toàn cục: học sinh, phụ huynh, giáo viên. */
export const GET = route(async (req) => {
  const q = normalizeQuery(new URL(req.url).searchParams.get("q") ?? "");
  if (q.length < 2) return { students: [], parents: [], teachers: [] };
  const where = { searchText: { contains: q } };
  const [students, parents, teachers] = await Promise.all([
    prisma.student.findMany({
      where,
      take: 8,
      select: { id: true, code: true, fullName: true, englishName: true, center: { select: { name: true, color: true } } },
    }),
    prisma.parent.findMany({ where, take: 5, select: { id: true, fullName: true, phone: true } }),
    prisma.teacher.findMany({ where, take: 5, select: { id: true, code: true, displayName: true, role: true } }),
  ]);
  return { students, parents, teachers };
});
