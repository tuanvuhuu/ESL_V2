import { NextResponse } from "next/server";
import { createSession, hashPassword, sessionCookie, toViewer } from "@/server/auth";
import { prisma } from "@/server/db";
import { body, forbidden, publicRoute } from "@/server/http";
import { setupSchema } from "@/server/validators";

/** Hệ thống mới cài, chưa có tài khoản nào: cho tạo tài khoản quản lý đầu tiên. */
export const GET = publicRoute(async () => ({ needsSetup: (await prisma.user.count()) === 0 }));

export const POST = publicRoute(async (req) => {
  const data = await body(req, setupSchema);
  const user = await prisma.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) throw forbidden("Hệ thống đã có tài khoản. Đăng nhập để tiếp tục.");
    return tx.user.create({
      data: { username: data.username, fullName: data.fullName, role: "MANAGER", passwordHash: await hashPassword(data.password) },
    });
  });
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json(toViewer(user));
  res.headers.set("Set-Cookie", sessionCookie(req, token, expiresAt));
  return res;
});
