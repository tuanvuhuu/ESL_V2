import { normalizeVi } from "@/lib/text";
import { prisma } from "@/server/db";
import { route } from "@/server/http";

/** Hồ sơ có cùng họ tên (không dấu) và ngày sinh, để cảnh báo trùng trước khi lưu. */
export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const name = normalizeVi(sp.get("name"));
  const dob = sp.get("dob") ?? "";
  const excludeId = Number(sp.get("excludeId")) || 0;
  if (!name || !dob) return [];
  const sameDob = await prisma.student.findMany({
    where: { dob, id: { not: excludeId } },
    select: { id: true, code: true, fullName: true, dob: true, center: { select: { name: true } } },
  });
  return sameDob.filter((s) => normalizeVi(s.fullName) === name);
});
