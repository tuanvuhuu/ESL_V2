import type { Prisma } from "@prisma/client";
import { STUDENT_STATUSES } from "@/lib/constants";
import { formatCode, normalizeQuery } from "@/lib/text";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { body, route } from "@/server/http";
import { refreshParentSearch } from "@/server/search-text";
import { studentCreateSchema } from "@/server/validators";

const listInclude = {
  center: { select: { id: true, name: true, color: true } },
  guardians: { include: { parent: true }, orderBy: { isPrimary: "desc" } },
  enrollments: {
    where: { leftAt: null, class: { status: { in: ["PLANNED", "ACTIVE", "SUSPENDED"] } } },
    include: { class: { select: { id: true, code: true, name: true } } },
  },
} satisfies Prisma.StudentInclude;

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const q = normalizeQuery(sp.get("q") ?? "");
  const centerId = Number(sp.get("centerId")) || undefined;
  const status = sp.get("status") || undefined;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(5000, Math.max(1, Number(sp.get("pageSize")) || 10));
  const sortField = sp.get("sort") === "fullName" ? "fullName" : sp.get("sort") === "dob" ? "dob" : "id";
  const sortOrder = sp.get("order") === "asc" ? "asc" : "desc";

  const base: Prisma.StudentWhereInput = {
    ...(centerId ? { centerId } : {}),
    ...(q.length > 0 ? { searchText: { contains: q } } : {}),
  };
  const where = { ...base, ...(status ? { status } : {}) };

  const [items, total, grouped] = await Promise.all([
    prisma.student.findMany({
      where,
      include: listInclude,
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
    prisma.student.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = Object.fromEntries(STUDENT_STATUSES.map((s) => [s.value, 0]));
  let all = 0;
  for (const g of grouped) {
    counts[g.status] = g._count._all;
    all += g._count._all;
  }
  return { items, total, counts: { ALL: all, ...counts } };
});

export const POST = route(async (req) => {
  const { student, parent } = await body(req, studentCreateSchema);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.parent.findUnique({ where: { phone: parent.phone } });
    const p =
      existing ??
      (await tx.parent.create({
        data: { fullName: parent.fullName, phone: parent.phone, zalo: parent.zalo, note: parent.note },
      }));
    const created = await tx.student.create({ data: { ...student, code: `TMP-${Date.now()}-${Math.random()}` } });
    const s = await tx.student.update({ where: { id: created.id }, data: { code: formatCode("HS", created.id) } });
    await tx.studentGuardian.create({
      data: { studentId: s.id, parentId: p.id, relation: parent.relation, isPrimary: true, isPayer: true },
    });
    await refreshParentSearch(tx, p.id);
    await logChange(tx, "Student", s.id, "create", { fullName: [null, s.fullName] });
    return s;
  });
});
