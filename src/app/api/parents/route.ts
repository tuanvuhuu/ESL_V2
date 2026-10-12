import { normalizeQuery, normalizePhone } from "@/lib/text";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { body, conflict, route } from "@/server/http";
import { refreshParentSearch } from "@/server/search-text";
import { parentSchema } from "@/server/validators";

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const phone = sp.get("phone");
  // Tra cứu chính xác theo SĐT (dùng khi thêm học sinh).
  if (phone) {
    return prisma.parent.findUnique({
      where: { phone: normalizePhone(phone) },
      include: { children: { include: { student: { select: { id: true, fullName: true, code: true } } } } },
    });
  }
  const q = normalizeQuery(sp.get("q") ?? "");
  const centerId = Number(sp.get("centerId")) || undefined;
  return prisma.parent.findMany({
    where: {
      ...(q ? { searchText: { contains: q } } : {}),
      ...(centerId ? { children: { some: { student: { centerId } } } } : {}),
    },
    include: {
      children: {
        include: {
          student: {
            select: { id: true, code: true, fullName: true, status: true, center: { select: { id: true, name: true, color: true } } },
          },
        },
      },
    },
    orderBy: { id: "desc" },
    take: 500,
  });
});

export const POST = route(async (req) => {
  const data = await body(req, parentSchema);
  const dup = await prisma.parent.findUnique({ where: { phone: data.phone } });
  if (dup) throw conflict(`SĐT này đã thuộc phụ huynh ${dup.fullName}`);
  return prisma.$transaction(async (tx) => {
    const p = await tx.parent.create({ data });
    await refreshParentSearch(tx, p.id);
    await logChange(tx, "Parent", p.id, "create", { fullName: [null, p.fullName] });
    return p;
  });
});
