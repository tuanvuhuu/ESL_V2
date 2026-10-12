import { NextResponse } from "next/server";
import {
  clearLoginFailures,
  createSession,
  loginBlocked,
  recordLoginFailure,
  sessionCookie,
  toViewer,
  verifyPassword,
} from "@/server/auth";
import { prisma } from "@/server/db";
import { body, HttpError, publicRoute } from "@/server/http";
import { loginSchema } from "@/server/validators";

export const POST = publicRoute(async (req) => {
  const { username, password } = await body(req, loginSchema);
  if (loginBlocked(username)) throw new HttpError(429, "Sai mật khẩu nhiều lần. Thử lại sau 15 phút hoặc nhờ quản lý đặt lại mật khẩu.");
  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    recordLoginFailure(username);
    throw new HttpError(401, "Sai tên đăng nhập hoặc mật khẩu");
  }
  if (!user.active) throw new HttpError(403, "Tài khoản đã bị khóa. Liên hệ quản lý.");
  clearLoginFailures(username);
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json(toViewer(user));
  res.headers.set("Set-Cookie", sessionCookie(req, token, expiresAt));
  return res;
});
