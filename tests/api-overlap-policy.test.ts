// B4: đổi cách tính trùng giờ có ngày hiệu lực; tháng đã chốt giữ nguyên cách cũ.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PUT as putOverlap, GET as getOverlap } from "@/app/api/payroll/overlap/route";
import { computeMonthlySalary, type TeachingSession } from "@/lib/payroll";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";
import { overlapRuleAt } from "@/server/payroll";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a"];
let teacherId = 0;
let original: { overlapPolicy: string; overlapRatio: number | null } = { overlapPolicy: "SINGLE", overlapRatio: 1.5 };
let lockedId = 0;

async function put(who: string, payload: unknown) {
  const headers = new Headers({ "content-type": "application/json", cookie: `${SESSION_COOKIE}=${tokens[who]}` });
  const res = await putOverlap(new Request("http://localhost/x", { method: "PUT", headers, body: JSON.stringify(payload) }), {} as never);
  return { status: res.status, data: await res.json() };
}

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  const t = await prisma.teacher.findFirstOrThrow({ where: { status: "ACTIVE", overlapHistory: { none: {} } } });
  teacherId = t.id;
  original = { overlapPolicy: t.overlapPolicy, overlapRatio: t.overlapRatio };
});

afterAll(async () => {
  if (lockedId) await prisma.payrollPeriod.delete({ where: { id: lockedId } });
  await prisma.teacherOverlapPolicy.deleteMany({ where: { teacherId } });
  await prisma.teacher.update({ where: { id: teacherId }, data: original });
  await prisma.auditLog.deleteMany({ where: { entity: "Teacher", entityId: teacherId, action: "overlap-policy" } });
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("B4: cách tính trùng giờ có ngày hiệu lực", () => {
  it("chỉ quản lý được đổi", async () => {
    expect((await put("giaovu.a", { teacherId, overlapPolicy: "FULL", effectiveDate: "2098-01-01" })).status).toBe(403);
  });

  it("lưu mốc cũ rồi thêm cách mới với ngày hiệu lực", async () => {
    const res = await put("quanly", { teacherId, overlapPolicy: "FULL", effectiveDate: "2098-01-01" });
    expect(res.status).toBe(200);
    const headers = new Headers({ cookie: `${SESSION_COOKIE}=${tokens.quanly}` });
    const hist = await (await getOverlap(new Request(`http://localhost/x?teacherId=${teacherId}`, { headers }), {} as never)).json();
    expect(hist).toHaveLength(2);

    const t = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId }, include: { overlapHistory: true } });
    expect(overlapRuleAt(t, "2097-12-31").policy).toBe(original.overlapPolicy);
    expect(overlapRuleAt(t, "2098-01-01").policy).toBe("FULL");
    expect(overlapRuleAt(t, "2099-06-01").policy).toBe("FULL");
  });

  it("không đặt ngày hiệu lực vào tháng đã chốt lương", async () => {
    const p = await prisma.payrollPeriod.create({
      data: { month: "2098-05", teacherId, status: "LOCKED", totalHours: 0, teachingPay: 0, finalPay: 0 },
    });
    lockedId = p.id;
    expect((await put("quanly", { teacherId, overlapPolicy: "RATIO", overlapRatio: 1.5, effectiveDate: "2098-04-01" })).status).toBe(400);
    expect((await put("quanly", { teacherId, overlapPolicy: "RATIO", overlapRatio: 1.5, effectiveDate: "2098-06-01" })).status).toBe(200);
  });
});

describe("B4: tính lương theo cách của từng buổi", () => {
  const mk = (id: number, date: string, policy: "SINGLE" | "FULL"): TeachingSession => ({
    sessionId: id, date, startTime: "08:00", endTime: "09:00", centerId: 1, role: "TEACHER", hourlyRate: 100_000, overlapPolicy: policy,
  });
  it("hai buổi trùng giờ cùng ngày: SINGLE chia đều, FULL tính đủ", () => {
    const sessions = [mk(1, "2026-01-05", "SINGLE"), { ...mk(2, "2026-01-05", "SINGLE"), centerId: 2 }, mk(3, "2026-02-05", "FULL"), { ...mk(4, "2026-02-05", "FULL"), centerId: 2 }];
    const r = computeMonthlySalary({ sessions });
    expect(r.sessionDetails.map((d) => d.pay)).toEqual([50_000, 50_000, 100_000, 100_000]);
  });
});