import { canManageSettings } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { hashPassword } from "@/server/auth";
import { prisma } from "@/server/db";
import { allow, body, conflict, route } from "@/server/http";
import { userSelect } from "@/server/users";
import { userCreateSchema } from "@/server/validators";

export const GET = route(async (_req, _ctx, viewer) => {
  allow(canManageSettings(viewer));
  return prisma.user.findMany({ select: userSelect, orderBy: [{ active: "desc" }, { id: "asc" }] });
});

export const POST = route(async (req, _ctx, viewer) => {
  allow(canManageSettings(viewer));
  const { password, ...data } = await body(req, userCreateSchema);
  if (await prisma.user.findUnique({ where: { username: data.username } })) throw conflict(`Tên đăng nhập ${data.username} đã có người dùng`);
  if (data.teacherId && (await prisma.user.findUnique({ where: { teacherId: data.teacherId } })))
    throw conflict("Giáo viên này đã có tài khoản");
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { ...data, passwordHash: await hashPassword(password) }, select: userSelect });
    await logChange(tx, "User", u.id, "create", { username: [null, u.username], role: [null, u.role] });
    return u;
  });
});
