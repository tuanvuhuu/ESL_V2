// B1: Quản lý sửa tay giờ tính lương của một buổi, bắt buộc lý do, có nhật ký, tháng đã chốt thì chặn.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PUT as putHours } from "@/app/api/sessions/[id]/payroll-hours/route";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";
import { getTeacherMonthlyDetails } from "@/server/payroll";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a", "lan"];

async function call(who: string, sessionId: number, payload: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("cookie", `${SESSION_COOKIE}=${tokens[who]}`);
  const res = await putHours(
    new Request("http://localhost/x", { method: "PUT", headers, body: JSON.stringify(payload) }),
    { params: Promise.resolve({ id: String(sessionId) }) } as never,
  );
  return { status: res.status, data: await res.json() };
}

let sessionId = 0;
let teacherId = 0;
let month = "";
let lockedPeriodId = 0;

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  // Buổi chưa bị chốt lương: tháng của người dạy không có bảng lương khác DRAFT.
  const locked = await prisma.payrollPeriod.findMany({ where: { status: { not: "DRAFT" } }, select: { month: true, teacherId: true } });
  const key = new Set(locked.map((p) => `${p.month}:${p.teacherId}`));
  const candidates = await prisma.classSession.findMany({
    where: { status: "SCHEDULED", payrollMinutes: null },
    include: { class: { include: { assistants: true } } },
    orderBy: { date: "desc" },
    take: 200,
  });
  const s = candidates.find((c) => ![c.teacherId, ...c.class.assistants.map((a) => a.teacherId)].some((t) => key.has(`${c.date.slice(0, 7)}:${t}`)));
  if (!s) throw new Error("Không có buổi nào để thử");
  sessionId = s.id;
  teacherId = s.teacherId;
  month = s.date.slice(0, 7);
});

afterAll(async () => {
  if (lockedPeriodId) await prisma.payrollPeriod.delete({ where: { id: lockedPeriodId } });
  await prisma.classSession.update({ where: { id: sessionId }, data: { payrollMinutes: null, payrollNote: null } });
  await prisma.auditLog.deleteMany({ where: { entity: "Session", entityId: sessionId, action: "payroll-hours" } });
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("B1: sửa giờ tính lương từng buổi", () => {
  it("chỉ quản lý được sửa", async () => {
    expect((await call("giaovu.a", sessionId, { minutes: 60, note: "Thử quyền" })).status).toBe(403);
    expect((await call("lan", sessionId, { minutes: 60, note: "Thử quyền" })).status).toBe(403);
  });

  it("bắt buộc lý do và số phút hợp lệ", async () => {
    expect((await call("quanly", sessionId, { minutes: 60, note: "" })).status).toBe(400);
    expect((await call("quanly", sessionId, { minutes: -5, note: "Số âm" })).status).toBe(400);
    expect((await call("quanly", sessionId, { minutes: 5000, note: "Quá lớn" })).status).toBe(400);
  });

  it("sửa giờ, bảng chi tiết dùng giờ mới, có nhật ký; bỏ sửa tay thì quay về giờ của buổi", async () => {
    const before = await getTeacherMonthlyDetails(teacherId, month);
    const row0 = before.sessions.find((r) => r.id === sessionId)!;
    expect(row0.isManual).toBe(false);

    const res = await call("quanly", sessionId, { minutes: 37, note: "Lớp kéo dài thêm" });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ payrollMinutes: 37, payrollNote: "Lớp kéo dài thêm" });

    const after = await getTeacherMonthlyDetails(teacherId, month);
    const row1 = after.sessions.find((r) => r.id === sessionId)!;
    expect(row1.durationMinutes).toBe(37);
    expect(row1.isManual).toBe(true);
    expect(row1.payrollNote).toBe("Lớp kéo dài thêm");

    const log = await prisma.auditLog.findFirst({ where: { entity: "Session", entityId: sessionId, action: "payroll-hours" }, orderBy: { id: "desc" } });
    expect(log).not.toBeNull();
    expect(JSON.parse(log!.changes)).toMatchObject({ payrollMinutes: [null, 37], reason: [null, "Lớp kéo dài thêm"] });

    const reset = await call("quanly", sessionId, { minutes: null, note: "Bỏ sửa tay" });
    expect(reset.status).toBe(200);
    const back = await getTeacherMonthlyDetails(teacherId, month);
    const row2 = back.sessions.find((r) => r.id === sessionId)!;
    expect(row2.durationMinutes).toBe(row0.durationMinutes);
    expect(row2.isManual).toBe(false);
  });

  it("tháng đã chốt thì chặn", async () => {
    const p = await prisma.payrollPeriod.create({ data: { month, teacherId, status: "LOCKED" } });
    lockedPeriodId = p.id;
    expect((await call("quanly", sessionId, { minutes: 50, note: "Sau khi chốt" })).status).toBe(400);
  });
});
