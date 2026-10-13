// API khung chương trình, điểm kiểm tra, mua thêm buổi, báo cáo học sinh / phòng lớp và nhập Excel.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getLessons, PUT as putLessons } from "@/app/api/courses/[id]/lessons/route";
import { GET as getAttendance } from "@/app/api/sessions/[id]/attendance/route";
import { PUT as putScores } from "@/app/api/sessions/[id]/scores/route";
import { POST as renew } from "@/app/api/classes/[id]/enrollments/[enrollmentId]/renew/route";
import { GET as studentReport } from "@/app/api/reports/students/route";
import { GET as utilReport } from "@/app/api/reports/utilization/route";
import { POST as importStudents } from "@/app/api/import/students/route";
import { todayISO } from "@/lib/dates";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a", "giaovu.b", "lan"];

async function call(
  handler: (req: Request, ctx: never) => Promise<Response>,
  url: string,
  who: string,
  init: { method?: string; body?: unknown } = {},
  params: Record<string, string> = {},
) {
  const headers = new Headers({ cookie: `${SESSION_COOKIE}=${tokens[who]}` });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const res = await handler(
    new Request(`http://localhost${url}`, { method: init.method ?? "GET", headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined }),
    { params: Promise.resolve(params) } as never,
  );
  return { status: res.status, data: await res.json() };
}

let tempCourseId = 0;
let sessionId = 0;
let sessionStudents: number[] = [];
let enrollment: { id: number; classId: number; purchasedSessions: number | null; tuitionFee: number | null; dueDate: string | null };
const importedNames = ["Học Sinh Nhập Thử", "Học Sinh Nhập Thử Hai"];

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  tempCourseId = (await prisma.course.create({ data: { name: `Khóa thử ${Date.now()}`, totalSessions: 3 } })).id;
  // Buổi đã qua, đã điểm danh, của lớp Ms Lan dạy ở trung tâm A.
  const lan = await prisma.teacher.findFirstOrThrow({ where: { displayName: "Ms Lan" } });
  const s = await prisma.classSession.findFirstOrThrow({
    where: { teacherId: lan.id, date: { lt: todayISO() }, status: "SCHEDULED", attendanceTakenAt: { not: null }, class: { center: { code: "A" } } },
    include: { attendances: true },
    orderBy: { date: "desc" },
  });
  sessionId = s.id;
  sessionStudents = s.attendances.map((a) => a.studentId);
  const e = await prisma.classEnrollment.findFirstOrThrow({ where: { leftAt: null, class: { center: { code: "A" } } } });
  enrollment = { id: e.id, classId: e.classId, purchasedSessions: e.purchasedSessions, tuitionFee: e.tuitionFee, dueDate: e.dueDate };
});

afterAll(async () => {
  await prisma.course.delete({ where: { id: tempCourseId } });
  await prisma.testScore.deleteMany({ where: { sessionId } });
  await prisma.classEnrollment.update({
    where: { id: enrollment.id },
    data: { purchasedSessions: enrollment.purchasedSessions, tuitionFee: enrollment.tuitionFee, dueDate: enrollment.dueDate },
  });
  const imported = await prisma.student.findMany({ where: { fullName: { in: importedNames } }, include: { guardians: true } });
  const ids = imported.map((s) => s.id);
  await prisma.classEnrollment.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { entity: "Student", entityId: { in: ids } } });
  await prisma.studentGuardian.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.student.deleteMany({ where: { id: { in: ids } } });
  await prisma.parent.deleteMany({ where: { phone: "0987000111" } });
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("Khung chương trình", () => {
  const lessons = [
    { index: 1, title: "Unit 1", materials: [{ name: "Slide", url: "https://example.com/u1" }] },
    { index: 2, title: "Kiểm tra", testKind: "QUIZ" },
  ];
  it("chỉ quản lý sửa được", async () => {
    const res = await call(putLessons, "/x", "giaovu.a", { method: "PUT", body: { lessons } }, { id: String(tempCourseId) });
    expect(res.status).toBe(403);
  });
  it("quản lý lưu, giáo viên xem được; bài bỏ khỏi danh sách bị xóa", async () => {
    const saved = await call(putLessons, "/x", "quanly", { method: "PUT", body: { lessons } }, { id: String(tempCourseId) });
    expect(saved.status).toBe(200);
    expect(saved.data).toHaveLength(2);
    const again = await call(putLessons, "/x", "quanly", { method: "PUT", body: { lessons: [lessons[1]] } }, { id: String(tempCourseId) });
    expect(again.data.map((l: { index: number }) => l.index)).toEqual([2]);
    const read = await call(getLessons, "/x", "lan", {}, { id: String(tempCourseId) });
    expect(read.status).toBe(200);
    expect(read.data.lessons[0]).toMatchObject({ index: 2, testKind: "QUIZ", materials: [] });
  });
  it("chặn hai bài trùng số buổi và link sai", async () => {
    const dup = await call(putLessons, "/x", "quanly", { method: "PUT", body: { lessons: [lessons[0], { ...lessons[1], index: 1 }] } }, { id: String(tempCourseId) });
    expect(dup.status).toBe(400);
    const bad = await call(putLessons, "/x", "quanly", { method: "PUT", body: { lessons: [{ index: 1, title: "x", materials: [{ name: "a", url: "khong-phai-link" }] }] } }, { id: String(tempCourseId) });
    expect(bad.status).toBe(400);
  });
  it("trang điểm danh có bài của buổi theo khung chương trình", async () => {
    const res = await call(getAttendance, "/x", "lan", {}, { id: String(sessionId) });
    expect(res.status).toBe(200);
    expect(res.data.lesson).toMatchObject({ index: res.data.session.index });
    expect(Array.isArray(res.data.scores)).toBe(true);
  });
});

describe("Điểm kiểm tra", () => {
  it("giáo vụ trung tâm khác không nhập được", async () => {
    const res = await call(putScores, "/x", "giaovu.b", { method: "PUT", body: { kind: "QUIZ", items: [] } }, { id: String(sessionId) });
    expect(res.status).toBe(403);
  });
  it("giáo viên nhập điểm, tổng tự tính; xóa hết điểm thì bỏ dòng điểm", async () => {
    const [a, b] = sessionStudents;
    const res = await call(
      putScores,
      "/x",
      "lan",
      { method: "PUT", body: { kind: "MIDTERM", items: [{ studentId: a, listening: 7, speaking: 8, reading: 6.5, writing: 7 }, { studentId: b, total: 9 }] } },
      { id: String(sessionId) },
    );
    expect(res.status).toBe(200);
    const saved = await prisma.testScore.findMany({ where: { sessionId }, orderBy: { studentId: "asc" } });
    expect(saved.find((x) => x.studentId === a)).toMatchObject({ kind: "MIDTERM", total: 7.1 });
    expect(saved.find((x) => x.studentId === b)?.total).toBe(9);
    await call(putScores, "/x", "lan", { method: "PUT", body: { kind: "MIDTERM", items: [{ studentId: b }] } }, { id: String(sessionId) });
    expect(await prisma.testScore.count({ where: { sessionId, studentId: b } })).toBe(0);
  });
  it("chặn điểm ngoài thang 10", async () => {
    const res = await call(putScores, "/x", "lan", { method: "PUT", body: { kind: "QUIZ", items: [{ studentId: sessionStudents[0], listening: 11 }] } }, { id: String(sessionId) });
    expect(res.status).toBe(400);
  });
});

describe("Mua thêm buổi", () => {
  it("giáo vụ trung tâm khác bị chặn, giáo vụ trung tâm lớp cộng được buổi và học phí", async () => {
    const p = { id: String(enrollment.classId), enrollmentId: String(enrollment.id) };
    const denied = await call(renew, "/x", "giaovu.b", { method: "POST", body: { sessions: 4, amount: 600000 } }, p);
    expect(denied.status).toBe(403);
    const before = await prisma.classEnrollment.findUniqueOrThrow({ where: { id: enrollment.id }, include: { class: { include: { course: true } } } });
    const ok = await call(renew, "/x", "giaovu.a", { method: "POST", body: { sessions: 4, amount: 600000, dueDate: "2030-01-01" } }, p);
    expect(ok.status).toBe(200);
    expect(ok.data.purchasedSessions).toBe((before.purchasedSessions ?? before.class.totalSessions) + 4);
    expect(ok.data.tuitionFee).toBe((before.tuitionFee ?? before.class.course?.tuition ?? 0) + 600000);
    expect(ok.data.dueDate).toBe("2030-01-01");
  });
});

describe("Báo cáo học sinh, sử dụng phòng và lớp", () => {
  it("giáo viên không xem được", async () => {
    expect((await call(studentReport, "/api/reports/students", "lan")).status).toBe(403);
    expect((await call(utilReport, "/api/reports/utilization", "lan")).status).toBe(403);
  });
  it("quản lý xem được số liệu", async () => {
    const s = await call(studentReport, `/api/reports/students?month=${todayISO().slice(0, 7)}`, "quanly");
    expect(s.status).toBe(200);
    expect(s.data.byStatus.STUDYING).toBeGreaterThan(0);
    expect(s.data.retention).toHaveProperty("rate");
    const u = await call(utilReport, "/api/reports/utilization", "quanly");
    expect(u.status).toBe(200);
    expect(u.data.classes.length).toBeGreaterThan(0);
    expect(u.data.rooms[0].parts).toHaveProperty("evening");
  });
});

describe("Nhập học sinh từ Excel", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    fullName: importedNames[0],
    dob: "15/03/2016",
    centerCode: "A",
    parentName: "Phụ Huynh Nhập Thử",
    parentPhone: "0987000111",
    ...over,
  });
  it("giáo viên không nhập được", async () => {
    const res = await call(importStudents, "/x", "lan", { method: "POST", body: { dryRun: true, rows: [row()] } });
    expect(res.status).toBe(403);
  });
  it("kiểm tra trước: báo lỗi theo dòng, giáo vụ không nhập cho trung tâm khác", async () => {
    const res = await call(importStudents, "/x", "giaovu.a", {
      method: "POST",
      body: { dryRun: true, rows: [row(), row({ fullName: "X", centerCode: "B" }), row({ fullName: "Y", classCode: "KHONGCO" }), row()] },
    });
    expect(res.status).toBe(200);
    const [ok, otherCenter, noClass, dup] = res.data.checked;
    expect(ok.errors).toEqual([]);
    expect(otherCenter.errors.join()).toContain("trung tâm mình");
    expect(noClass.errors.join()).toContain("KHONGCO");
    expect(dup.errors.join()).toContain("Trùng với dòng 2");
    expect(await prisma.student.count({ where: { fullName: importedNames[0] } })).toBe(0);
  });
  it("nhập thật: tạo học sinh, phụ huynh, ghi danh với số buổi còn lại và công nợ", async () => {
    const cls = await prisma.classGroup.findFirstOrThrow({ where: { center: { code: "A" }, status: { in: ["ACTIVE", "PLANNED"] } }, include: { _count: { select: { enrollments: { where: { leftAt: null } } } } }, orderBy: { id: "asc" } });
    const res = await call(importStudents, "/x", "giaovu.a", {
      method: "POST",
      body: { dryRun: false, rows: [row(), row({ fullName: importedNames[1], dob: "2017-01-02", classCode: cls.code, remainingSessions: 7, debt: "1.200.000" })] },
    });
    expect(res.status).toBe(200);
    expect(res.data.created).toBe(2);
    const waiting = await prisma.student.findFirstOrThrow({ where: { fullName: importedNames[0] }, include: { guardians: true } });
    expect(waiting.status).toBe("WAITING");
    const studying = await prisma.student.findFirstOrThrow({ where: { fullName: importedNames[1] }, include: { enrollments: true, guardians: true } });
    expect(studying.status).toBe("STUDYING");
    expect(studying.enrollments[0]).toMatchObject({ classId: cls.id, purchasedSessions: 7, tuitionFee: 1_200_000, joinedAt: todayISO() });
    // Cùng SĐT: hai em dùng chung một phụ huynh (anh chị em).
    expect(studying.guardians[0].parentId).toBe(waiting.guardians[0].parentId);
    const again = await call(importStudents, "/x", "giaovu.a", { method: "POST", body: { dryRun: true, rows: [row()] } });
    expect(again.data.checked[0].errors.join()).toContain("Đã có học sinh");
  });
});
