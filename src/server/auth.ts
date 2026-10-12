import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Role, Viewer } from "@/lib/permissions";
import { prisma } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "esl_session";
export const SESSION_DAYS = 30;

/** Băm mật khẩu: "scrypt$<salt hex>$<hash hex>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

/** Tạo phiên mới, trả về mã để đặt vào cookie. */
export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await prisma.userSession.create({ data: { id: tokenId(token), userId, expiresAt } });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return { token, expiresAt };
}

export async function deleteSession(token: string | null) {
  if (token) await prisma.userSession.deleteMany({ where: { id: tokenId(token) } });
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function toViewer(u: { id: number; username: string; fullName: string; role: string; centerId: number | null; teacherId: number | null }): Viewer {
  return { id: u.id, username: u.username, fullName: u.fullName, role: u.role as Role, centerId: u.centerId, teacherId: u.teacherId };
}

/** Người đang đăng nhập theo cookie, hoặc null nếu chưa đăng nhập / hết hạn / bị khóa. */
export async function getViewer(req: Request): Promise<Viewer | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const s = await prisma.userSession.findUnique({ where: { id: tokenId(token) }, include: { user: true } });
  if (!s || !s.user.active) return null;
  if (s.expiresAt < new Date()) {
    await prisma.userSession.delete({ where: { id: s.id } }).catch(() => undefined);
    return null;
  }
  return toViewer(s.user);
}

/** Cookie phiên; bật Secure khi trang chạy qua HTTPS (kể cả sau proxy). */
export function sessionCookie(req: Request, token: string, expiresAt: Date) {
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const secure = https ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

// Chặn dò mật khẩu: sai 5 lần trong 15 phút thì khóa tên đăng nhập đó 15 phút.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map<string, { count: number; first: number }>();

export function loginBlocked(username: string, now = Date.now()) {
  const f = fails.get(username);
  if (!f) return false;
  if (now - f.first > WINDOW_MS) {
    fails.delete(username);
    return false;
  }
  return f.count >= MAX_FAILS;
}

export function recordLoginFailure(username: string, now = Date.now()) {
  const f = fails.get(username);
  if (!f || now - f.first > WINDOW_MS) fails.set(username, { count: 1, first: now });
  else f.count++;
}

export const clearLoginFailures = (username: string) => fails.delete(username);

// Người thao tác hiện tại, để nhật ký ghi đúng tên mà không phải truyền qua từng hàm.
const actorStore = new AsyncLocalStorage<string>();
export const runAsActor = <T>(actor: string, fn: () => T) => actorStore.run(actor, fn);
export const currentActor = () => actorStore.getStore() ?? "Hệ thống";
