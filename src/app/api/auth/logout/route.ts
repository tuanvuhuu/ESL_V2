import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSession, readSessionToken } from "@/server/auth";
import { publicRoute } from "@/server/http";

export const POST = publicRoute(async (req) => {
  await deleteSession(readSessionToken(req));
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
});
