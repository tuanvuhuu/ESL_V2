// Điểm danh, số buổi còn lại và học bù ở tầng API, trên dữ liệu mẫu (`npm run db:push && npm run db:seed`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as postMakeup } from "@/app/api/makeups/route";
import { GET as getOptions } from "@/app/api/makeups/options/route";
import { DELETE as deleteMakeup } from "@/app/api/makeups/[id]/route";
import { GET as getAttendance, PUT as putAttendance } from "@/app/api/sessions/[id]/attendance/route";
import { GET as getAttention } from "@/app/api/attention/route";
import { GET as getMyClasses } from "@/app/api/me/classes/route";
import { todayISO } from "@/lib/dates";
import { balancesFor } from "@/server/attendance";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a", "giaovu.b", "lan", "thu"];

async function call(handler: (req: Request, ctx: never) => Promise<Response>, url: string, who: string, init: RequestInit = {}, params: Record<string, string> = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE}=${tokens[who]}`);
  const res = await handler(new Request(`http://localhost${url}`, { ...init, headers }), { params: Promise.resolve(params) } as never);
  return { status: res.status, data: await res.json() };
}

const put = (sessionId: number, who: string, body: unknown) =>
  call(putAttendance, `/api/sessions/${sessionId}/attendance`, who, { method: "PUT", body: JSON.stringify(body) }, { id: String(sessionId) });

let lionsId = 0;

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  lionsId = (await prisma.classGroup.findFirstOrThrow({ where: { name: "KID1-Lions" } })).id;
});

afterAll(async () => {
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("quyền điểm danh", () => {
  it("giáo viên và trợ giảng của lớp điểm danh được; giáo vụ trung tâm khác thì không", async () => {
    const s = await prisma.classSession.findFirstOrThrow({ where: { classId: lionsId, date: { lt: todayISO() } }, orderBy: { date: "desc" } });
    const lan = await call(getAttendance, `/api/sessions/${s.id}/attendance`, "lan", {}, { id: String(s.id) });
    expect(lan.status).toBe(200);
    expect(lan.data.canEdit).toBe(true);
    expect(lan.data.role).toBe("teacher");
    const items = lan.data.roster.map((r: { studentId: number }) => ({ studentId: r.studentId, status: "PRESENT" }));
    expect((await put(s.id, "thu", { items })).status).toBe(200);
    expect((await put(s.id, "giaovu.b", { items })).status).toBe(403);
    expect((await put(s.id, "giaovu.a", { items })).status).toBe(200);
  });

  it("giáo viên không mở được buổi của lớp khác", async () => {
    const other = await prisma.classSession.findFirstOrThrow({ where: { class: { name: "IELTS-A" } } });
    expect((await call(getAttendance, `/api/sessions/${other.id}/attendance`, "lan", {}, { id: String(other.id) })).status).toBe(404);
  });

  it("chưa đến ngày học thì chưa điểm danh được", async () => {
    const future = await prisma.classSession.findFirstOrThrow({ where: { classId: lionsId, date: { gt: todayISO() } } });
    const res = await put(future.id, "lan", { items: [] });
    expect(res.status).toBe(400);
  });
});

describe("số buổi còn lại", () => {
  it("vắng không phép trừ buổi, sửa lại có phép thì hoàn buổi", async () => {
    const s = await prisma.classSession.findFirstOrThrow({ where: { classId: lionsId, date: { lt: todayISO() } }, orderBy: { date: "asc" } });
    const roster = (await call(getAttendance, `/api/sessions/${s.id}/attendance`, "lan", {}, { id: String(s.id) })).data.roster;
    const first = roster[0];
    const base = roster.map((r: { studentId: number }) => ({ studentId: r.studentId, status: "PRESENT" }));
    await put(s.id, "lan", { items: base });
    const before = (await balancesFor(prisma, [first.enrollmentId])).get(first.enrollmentId)!;

    const excused = base.map((x: { studentId: number }) => (x.studentId === first.studentId ? { ...x, status: "EXCUSED", comment: "Ốm" } : x));
    expect((await put(s.id, "lan", { lessonContent: "Unit 1", items: excused })).status).toBe(200);
    const after = (await balancesFor(prisma, [first.enrollmentId])).get(first.enrollmentId)!;
    expect(after.remaining).toBe(before.remaining + 1);

    const saved = await prisma.classSession.findUniqueOrThrow({ where: { id: s.id } });
    expect(saved.lessonContent).toBe("Unit 1");
    expect(saved.attendanceTakenAt).not.toBeNull();
    const log = await prisma.auditLog.findFirst({ where: { entity: "Student", entityId: first.studentId, action: "attendance" }, orderBy: { id: "desc" } });
    expect(log).not.toBeNull();
  });
});

describe("học bù", () => {
  it("giáo vụ xếp học bù vào lớp cùng khóa; học sinh hiện trong danh sách điểm danh với nhãn học bù", async () => {
    const absence = await prisma.attendance.findFirstOrThrow({
      where: { status: { in: ["EXCUSED", "UNEXCUSED"] }, makeupId: null, makeupFor: { is: null }, session: { classId: lionsId } },
    });
    const options = await call(getOptions, `/api/makeups/options?absenceId=${absence.id}`, "giaovu.a");
    expect(options.status).toBe(200);
    expect(options.data.length).toBeGreaterThan(0);
    const target = options.data[0];
    expect(target.class.id).not.toBe(lionsId);

    const body = JSON.stringify({ absenceId: absence.id, sessionId: target.id });
    expect((await call(postMakeup, "/api/makeups", "giaovu.b", { method: "POST", body })).status).toBe(403);
    const created = await call(postMakeup, "/api/makeups", "giaovu.a", { method: "POST", body });
    expect(created.status).toBe(200);
    expect((await call(postMakeup, "/api/makeups", "giaovu.a", { method: "POST", body })).status).toBe(400);

    const roster = (await call(getAttendance, `/api/sessions/${target.id}/attendance`, "quanly", {}, { id: String(target.id) })).data.roster;
    const row = roster.find((r: { studentId: number }) => r.studentId === absence.studentId);
    expect(row.makeup).not.toBeNull();
    expect(row.enrollmentId).toBe(absence.enrollmentId);

    const del = await call(deleteMakeup, `/api/makeups/${created.data.id}`, "giaovu.a", { method: "DELETE" }, { id: String(created.data.id) });
    expect(del.status).toBe(200);
  });
});

describe("màn hình tổng hợp", () => {
  it("danh sách cần chú ý chỉ dành cho văn phòng", async () => {
    expect((await call(getAttention, "/api/attention", "lan")).status).toBe(403);
    const res = await call(getAttention, "/api/attention", "quanly");
    expect(res.status).toBe(200);
    expect(res.data.lowBalance.length + res.data.exhausted.length).toBeGreaterThan(0);
  });

  it("lớp của tôi chỉ gồm lớp giáo viên dạy hoặc trợ giảng", async () => {
    const res = await call(getMyClasses, "/api/me/classes", "thu");
    expect(res.status).toBe(200);
    expect(res.data.map((c: { name: string }) => c.name)).toEqual(["KID1-Lions"]);
    expect(res.data[0].role).toBe("assistant");
    expect((await call(getMyClasses, "/api/me/classes", "quanly")).status).toBe(403);
  });
});
