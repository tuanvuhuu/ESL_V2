// Lịch rảnh, ngày nghỉ, dạy thay, chuyển lớp, bảo lưu ở tầng API, trên dữ liệu mẫu (`npm run db:push && npm run db:seed`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getAttention } from "@/app/api/attention/route";
import { POST as postTransfer } from "@/app/api/classes/[id]/enrollments/[enrollmentId]/transfer/route";
import { DELETE as deleteLeave } from "@/app/api/leaves/[id]/route";
import { GET as getAttendance } from "@/app/api/sessions/[id]/attendance/route";
import { GET as getSubstitutes } from "@/app/api/sessions/[id]/substitutes/route";
import { POST as postStatus } from "@/app/api/students/[id]/status/route";
import { PUT as putAvailability } from "@/app/api/teachers/[id]/availability/route";
import { POST as postLeave } from "@/app/api/teachers/[id]/leaves/route";
import { addDays, todayISO } from "@/lib/dates";
import { balancesFor } from "@/server/attendance";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a", "giaovu.b", "lan", "thu"];
const today = todayISO();

async function call(handler: (req: Request, ctx: never) => Promise<Response>, url: string, who: string, init: RequestInit = {}, params: Record<string, string> = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE}=${tokens[who]}`);
  const res = await handler(new Request(`http://localhost${url}`, { ...init, headers }), { params: Promise.resolve(params) } as never);
  return { status: res.status, data: await res.json() };
}
const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

let lanId = 0;
let johnId = 0;
let lionsId = 0;

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  lanId = (await prisma.teacher.findFirstOrThrow({ where: { displayName: "Ms Lan" } })).id;
  johnId = (await prisma.teacher.findFirstOrThrow({ where: { displayName: "Mr John" } })).id;
  lionsId = (await prisma.classGroup.findFirstOrThrow({ where: { name: "KID1-Lions" } })).id;
});

afterAll(async () => {
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("lịch rảnh", () => {
  it("giáo viên sửa lịch rảnh của mình; giáo vụ chỉ sửa người dạy ở trung tâm mình", async () => {
    const before = await prisma.teacherAvailability.findMany({ where: { teacherId: lanId } });
    const slots = [
      { weekday: 1, startTime: "17:00", endTime: "19:00" },
      { weekday: 1, startTime: "18:30", endTime: "21:00" },
    ];
    const res = await call(putAvailability, `/api/teachers/${lanId}/availability`, "lan", { method: "PUT", body: JSON.stringify({ slots }) }, { id: String(lanId) });
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({ weekday: 1, startTime: "17:00", endTime: "21:00" });

    const john = { method: "PUT", body: JSON.stringify({ slots }) };
    expect((await call(putAvailability, `/api/teachers/${johnId}/availability`, "lan", john, { id: String(johnId) })).status).toBe(404);
    expect((await call(putAvailability, `/api/teachers/${johnId}/availability`, "giaovu.b", john, { id: String(johnId) })).status).toBe(403);
    expect((await call(putAvailability, `/api/teachers/${johnId}/availability`, "giaovu.a", john, { id: String(johnId) })).status).toBe(200);

    await prisma.teacherAvailability.deleteMany({ where: { teacherId: { in: [lanId, johnId] } } });
    await prisma.teacherAvailability.createMany({ data: before.map(({ id: _id, ...s }) => s) });
  });
});

describe("đăng ký nghỉ và dạy thay", () => {
  it("đăng ký nghỉ hiện buổi bị ảnh hưởng, vào danh sách cần người dạy thay; gợi ý người dạy thay theo mức phù hợp", async () => {
    const s = await prisma.classSession.findFirstOrThrow({
      where: { classId: lionsId, teacherId: lanId, status: "SCHEDULED", date: { gt: addDays(today, 1), lte: addDays(today, 14) } },
      orderBy: { date: "asc" },
    });
    const body = { fromDate: s.date, toDate: s.date, reason: "Ốm" };
    expect((await call(postLeave, `/api/teachers/${lanId}/leaves`, "lan", post({ ...body, fromDate: addDays(today, -2) }), { id: String(lanId) })).status).toBe(400);
    const created = await call(postLeave, `/api/teachers/${lanId}/leaves`, "lan", post(body), { id: String(lanId) });
    expect(created.status).toBe(200);
    expect(created.data.affected.find((a: { id: number }) => a.id === s.id)?.role).toBe("teacher");
    expect((await call(postLeave, `/api/teachers/${lanId}/leaves`, "lan", post(body), { id: String(lanId) })).status).toBe(409);

    const att = await call(getAttention, "/api/attention", "giaovu.a");
    expect(att.data.needSubstitute.some((x: { id: number }) => x.id === s.id)).toBe(true);

    expect((await call(getSubstitutes, `/api/sessions/${s.id}/substitutes`, "giaovu.b", {}, { id: String(s.id) })).status).toBe(403);
    const subs = await call(getSubstitutes, `/api/sessions/${s.id}/substitutes`, "giaovu.a", {}, { id: String(s.id) });
    expect(subs.status).toBe(200);
    const lan = subs.data.find((c: { id: number }) => c.id === lanId);
    expect(lan.current).toBe(true);
    expect(lan.onLeave).toContain("Ốm");
    // Trợ giảng thuần không nằm trong danh sách dạy thay chính.
    expect(subs.data.some((c: { displayName: string }) => c.displayName === "Thư")).toBe(false);

    const del = await call(deleteLeave, `/api/leaves/${created.data.id}`, "lan", { method: "DELETE" }, { id: String(created.data.id) });
    expect(del.status).toBe(200);
  });
});

describe("chuyển lớp", () => {
  it("số buổi còn lại đi theo học sinh sang lớp mới; không chuyển sang lớp trung tâm khác nếu không có quyền", async () => {
    const ielts = await prisma.classGroup.findFirstOrThrow({ where: { name: "IELTS-A" } });
    const tigers = await prisma.classGroup.findFirstOrThrow({ where: { name: "KID2-Tigers" } });
    const from = await prisma.classEnrollment.findFirstOrThrow({ where: { classId: lionsId, leftAt: null, student: { status: "STUDYING" } } });
    const before = (await balancesFor(prisma, [from.id])).get(from.id)!;
    const url = `/api/classes/${lionsId}/enrollments/${from.id}/transfer`;
    const params = { id: String(lionsId), enrollmentId: String(from.id) };
    const date = addDays(today, 1);

    expect((await call(postTransfer, url, "giaovu.b", post({ toClassId: ielts.id, date }), params)).status).toBe(403);
    expect((await call(postTransfer, url, "giaovu.a", post({ toClassId: tigers.id, date }), params)).status).toBe(403);
    const res = await call(postTransfer, url, "giaovu.a", post({ toClassId: ielts.id, date, note: "Đổi lịch" }), params);
    expect(res.status).toBe(200);
    expect(res.data.carried).toBe(Math.max(0, before.remaining));

    const to = await prisma.classEnrollment.findUniqueOrThrow({ where: { id: res.data.enrollment.id } });
    expect(to).toMatchObject({ classId: ielts.id, joinedAt: date, purchasedSessions: res.data.carried, transferredFromId: from.id });
    const old = await prisma.classEnrollment.findUniqueOrThrow({ where: { id: from.id } });
    expect(old.leftAt).toBe(date);
    expect((await balancesFor(prisma, [from.id])).get(from.id)!.remaining).toBe(Math.min(0, before.remaining));

    await prisma.classEnrollment.delete({ where: { id: to.id } });
    await prisma.classEnrollment.update({ where: { id: from.id }, data: { leftAt: null, adjustment: from.adjustment, adjustmentNote: from.adjustmentNote } });
  });
});

describe("bảo lưu", () => {
  it("bảo lưu cần ngày quay lại; trong thời gian bảo lưu không có trong danh sách điểm danh; học lại thì có lại", async () => {
    const e = await prisma.classEnrollment.findFirstOrThrow({ where: { classId: lionsId, leftAt: null, student: { status: "STUDYING" } } });
    const s = await prisma.classSession.findFirstOrThrow({ where: { classId: lionsId, date: { gt: addDays(today, 1) } }, orderBy: { date: "asc" } });
    const studentUrl = `/api/students/${e.studentId}/status`;
    const p = { id: String(e.studentId) };
    const inRoster = async () => {
      const r = await call(getAttendance, `/api/sessions/${s.id}/attendance`, "quanly", {}, { id: String(s.id) });
      return r.data.roster.some((x: { studentId: number }) => x.studentId === e.studentId);
    };
    expect(await inRoster()).toBe(true);

    expect((await call(postStatus, studentUrl, "giaovu.a", post({ status: "RESERVED" }), p)).status).toBe(400);
    const res = await call(postStatus, studentUrl, "giaovu.a", post({ status: "RESERVED", startDate: today, expectedReturn: addDays(today, 30), reason: "Ôn thi" }), p);
    expect(res.status).toBe(200);
    expect(res.data.statusReason).toContain("đến");
    expect(await inRoster()).toBe(false);

    // Học lại từ ngày của buổi đó: có lại trong danh sách.
    expect((await call(postStatus, studentUrl, "giaovu.a", post({ status: "STUDYING", returnDate: s.date }), p)).status).toBe(200);
    expect(await inRoster()).toBe(true);
    const r = await prisma.reservation.findFirstOrThrow({ where: { studentId: e.studentId }, orderBy: { id: "desc" } });
    expect(r.returnedAt).toBe(s.date);
    await prisma.reservation.delete({ where: { id: r.id } });
  });
});
