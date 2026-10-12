import { prisma } from "@/server/db";
import { badRequest, route } from "@/server/http";

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  const id = Number(url.searchParams.get("id"));
  if (!entity || !id) throw badRequest("Thiếu entity hoặc id");
  const rows = await prisma.auditLog.findMany({
    where: { entity, entityId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({ ...r, changes: JSON.parse(r.changes) }));
});
