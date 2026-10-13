// B2: trợ giảng gắn theo từng buổi, có số phút riêng và được dùng khi tính lương.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getAssist, PUT as putAssist } from "@/app/api/sessions/[id]/assistants/route";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";
import { getTeacherMonthlyDetails } from "@/server/payroll";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "lan", "thu"];

async function call(who: string, method: "GET" | "PUT", sessionId: number, payload?: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("cookie", `${SESSION_COOKIE}=${tokens[who]}`);
  const init: RequestInit = { method, headers, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) };
  const handler = method === "GET" ? getAssist : putAssist;
  const res = await handler(new Request("http://localhost/x", init), { params: Promise.resolve({ id: String(sessionId) }) } as never);
  return { status: res.status, data: await res.json() };
}

let sessionId = 0;
let month = "";
let assistantId = 0;

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  const thu = await prisma.user.findUniqueOrThrow({ where: { username: "thu" } });
  assistantId = thu.teacherId!;
  const locked = await prisma.payrollPeriod.findMany({ where: { teacherId: assistantId, status: { not: "DRAFT" } }, select: { month: true } });
  const lockedMonths = new Set(locked.map((p) => p.month));
  const candidates = await prisma.classSession.findMany({
    where: { status: "SCHEDULED", teacherId: { not: assistantId }, assistants: { none: {} } },
    orderBy: { date: "desc" },
    take: 200,
  });
  const s = candidates.find((c) => !lockedMonths.has(c.date.slice(0, 7)));
  if (!s) throw new Error("Không có buổi nào để thử");
  sessionId = s.id;
  month = s.date.slice(0, 7);
});

afterAll(async () => {
  await prisma.sessionAssistant.deleteMany({ where: { sessionId } });
  await prisma.auditLog.deleteMany({ where: { entity: "Session", entityId: sessionId, action: "assistants" } });
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("B2: trợ giảng theo từng buổi", () => {
  it("giáo viên không được sửa", async () => {
    expect((await call("lan", "PUT", sessionId, { assistants: [{ teacherId: assistantId, minutes: 30 }] })).status).toBe(403);
  });

  it("không cho người dạy chính làm trợ giảng cùng buổi, không trùng người", async () => {
    const s = await prisma.classSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect((await call("quanly", "PUT", sessionId, { assistants: [{ teacherId: s.teacherId }] })).status).toBe(400);
    expect((await call("quanly", "PUT", sessionId, { assistants: [{ teacherId: assistantId }, { teacherId: assistantId }] })).status).toBe(400);
    expect((await call("quanly", "PUT", sessionId, { assistants: [{ teacherId: assistantId, minutes: -5 }] })).status).toBe(400);
  });

  it("đặt trợ giảng riêng với số phút riêng, có trong chi tiết lương và nhật ký", async () => {
    const res = await call("quanly", "PUT", sessionId, { assistants: [{ teacherId: assistantId, minutes: 30 }] });
    expect(res.status).toBe(200);
    const got = await call("quanly", "GET", sessionId);
    expect(got.data.source).toBe("SESSION");
    expect(got.data.assistants[0].minutes).toBe(30);

    const detail = await getTeacherMonthlyDetails(assistantId, month);
    const row = detail.sessions.find((x) => x.id === sessionId);
    expect(row?.role).toBe("ASSISTANT");
    expect(row?.durationMinutes).toBe(30);
    expect(row?.isManual).toBe(true);

    const log = await prisma.auditLog.findFirst({ where: { entity: "Session", entityId: sessionId, action: "assistants" } });
    expect(log).not.toBeNull();
  });

  it("danh sách rỗng thì quay về trợ giảng cả lớp", async () => {
    expect((await call("quanly", "PUT", sessionId, { assistants: [] })).status).toBe(200);
    const got = await call("quanly", "GET", sessionId);
    expect(got.data.source).toBe("CLASS");
    const detail = await getTeacherMonthlyDetails(assistantId, month);
    const row = detail.sessions.find((x) => x.id === sessionId);
    // Trợ giảng không thuộc lớp thì không còn thấy buổi này
    const isClassAssistant = got.data.assistants.some((a: { teacherId: number }) => a.teacherId === assistantId);
    expect(Boolean(row)).toBe(isClassAssistant);
  });
});
