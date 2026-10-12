import { hashPassword, readSessionToken, tokenId, verifyPassword } from "@/server/auth";
import { prisma } from "@/server/db";
import { badRequest, body, route } from "@/server/http";
import { changePasswordSchema } from "@/server/validators";

/** Người đang đăng nhập. */
export const GET = route(async (_req, _ctx, viewer) => viewer);

/** Tự đổi mật khẩu; đăng xuất các thiết bị khác. */
export const PUT = route(async (req, _ctx, viewer) => {
  const { current, next } = await body(req, changePasswordSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } });
  if (!(await verifyPassword(current, user.passwordHash))) throw badRequest("Mật khẩu hiện tại không đúng");
  const keep = tokenId(readSessionToken(req) ?? "");
  await prisma.$transaction([
    prisma.user.update({ where: { id: viewer.id }, data: { passwordHash: await hashPassword(next) } }),
    prisma.userSession.deleteMany({ where: { userId: viewer.id, id: { not: keep } } }),
  ]);
});
