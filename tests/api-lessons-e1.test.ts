// E1: bài tập về nhà giao theo buổi, chấm bài tập khi điểm danh, kế hoạch bài giảng theo lớp.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getPlan } from "@/app/api/classes/[id]/lessons/route";
import { GET as getAttendance, PUT as putAttendance } from "@/app/api/sessions/[id]/attendance/route";
import { assignedHomework, homeworkStats, nextHomeworkStatus } from "@/lib/curriculum";
import { todayISO } from "@/lib/dates";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "lan"];

async function call(
  handler: (req: Request, ctx: never) => Promise<Response>,
  who: string,
  init: { method?: string; body?: unknown } = {},
  params: Record<string, string> = {},
) {
  const headers = new Headers({ cookie: `${SESSION_COOKIE}=${tokens[who]}` });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const res = await handler(
    new Request("http://localhost/x", { method: init.method ?? "GET", headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined }),
    { params: Promise.resolve(params) } as never,
  );
  return { status: res.status, data: await res.json() };
}

describe("Bài tập về nhà: logic thuần", () => {
  it("chạm đổi vòng: chưa chấm → đã làm → chưa đủ → không làm → chưa chấm", () => {
    expect(nextHomeworkStatus(null)).toBe("DONE");
    expect(nextHomeworkStatus("DONE")).toBe("PARTIAL");
    expect(nextHomeworkStatus("PARTIAL")).toBe("MISSING");
    expect(nextHomeworkStatus("MISSING")).toBeNull();
  });
  it("tỉ lệ hoàn thành tính nửa cho làm chưa đủ, bỏ qua chưa chấm", () => {
    expect(homeworkStats(["DONE", "PARTIAL", "MISSING", null])).toEqual({ done: 1, partial: 1, missing: 1, checked: 3, rate: 50 });
    expect(homeworkStats([null]).rate).toBeNull();
  });
  it("bài tập giáo viên ghi riêng thắng bài tập trong khung", () => {
    expect(assignedHomework(" Workbook p.5 ", "Unit 1")).toBe("Workbook p.5");
    expect(assignedHomework("", "Unit 1")).toBe("Unit 1");
    expect(assignedHomework(null, null)).toBeNull();
  });
});

let classId = 0;
let prev: { id: number; index: number; homework: string | null };
let cur: { id: number; index: number; homework: string | null };
let saved: { id: number; homework: string | null }[] = [];
let createdLesson: number | null = null;
let otherClassId = 0;

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  const lan = await prisma.teacher.findFirstOrThrow({ where: { displayName: "Ms Lan" } });
  // Hai buổi liền nhau đã qua của một lớp Ms Lan dạy, buổi sau đã điểm danh.
  const sessions = await prisma.classSession.findMany({
    where: { teacherId: lan.id, status: "SCHEDULED", date: { lt: todayISO() }, class: { courseId: { not: null } } },
    orderBy: [{ classId: "asc" }, { index: "asc" }],
    include: { attendances: true },
  });
  for (let i = 1; i < sessions.length; i++) {
    const a = sessions[i - 1];
    const b = sessions[i];
    if (a.classId === b.classId && b.attendances.length > 0) {
      prev = a;
      cur = b;
      classId = b.classId;
      break;
    }
  }
  expect(classId).toBeGreaterThan(0);
  saved = (await prisma.attendance.findMany({ where: { sessionId: cur.id } })).map((a) => ({ id: a.id, homework: a.homework }));
  const cls = await prisma.classGroup.findUniqueOrThrow({ where: { id: classId } });
  const lesson = await prisma.courseLesson.findFirst({ where: { courseId: cls.courseId!, index: prev.index } });
  if (!lesson) createdLesson = (await prisma.courseLesson.create({ data: { courseId: cls.courseId!, index: prev.index, title: "Bài thử E1", homework: "Theo khung" } })).id;
  const other = await prisma.classGroup.findFirstOrThrow({
    where: { teacherId: { not: lan.id }, assistants: { none: { teacherId: lan.id } }, sessions: { none: { teacherId: lan.id } } },
  });
  otherClassId = other.id;
});

afterAll(async () => {
  await prisma.classSession.update({ where: { id: prev.id }, data: { homework: prev.homework } });
  await prisma.classSession.update({ where: { id: cur.id }, data: { homework: cur.homework } });
  for (const a of saved) await prisma.attendance.update({ where: { id: a.id }, data: { homework: a.homework } });
  if (createdLesson) await prisma.courseLesson.delete({ where: { id: createdLesson } });
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("Bài tập về nhà khi điểm danh", () => {
  it("buổi sau thấy bài tập giáo viên giao ở buổi trước", async () => {
    await prisma.classSession.update({ where: { id: prev.id }, data: { homework: "Workbook trang 12" } });
    const res = await call(getAttendance, "lan", {}, { id: String(cur.id) });
    expect(res.status).toBe(200);
    expect(res.data.homeworkToCheck).toMatchObject({ sessionId: prev.id, index: prev.index, text: "Workbook trang 12" });
  });

  it("chấm bài tập từng học sinh và giao bài tập mới; gửi thiếu trường bài tập thì giữ nguyên", async () => {
    const before = await call(getAttendance, "lan", {}, { id: String(cur.id) });
    const roster = before.data.roster as { studentId: number; status: string | null; comment: string | null }[];
    const items = roster.map((r, i) => ({ studentId: r.studentId, status: r.status ?? "PRESENT", comment: r.comment, homework: i === 0 ? "MISSING" : "DONE" }));
    const put = await call(putAttendance, "lan", { method: "PUT", body: { lessonContent: before.data.session.lessonContent, homework: "Học 10 từ mới", items } }, { id: String(cur.id) });
    expect(put.status).toBe(200);
    const after = await call(getAttendance, "lan", {}, { id: String(cur.id) });
    expect(after.data.session.homework).toBe("Học 10 từ mới");
    expect(after.data.roster.find((r: { studentId: number }) => r.studentId === roster[0].studentId).homework).toBe("MISSING");

    // Lưu lại không gửi bài tập: không mất kết quả đã chấm, không mất bài tập đã giao.
    const again = await call(
      putAttendance,
      "lan",
      { method: "PUT", body: { lessonContent: before.data.session.lessonContent, items: items.map(({ homework: _h, ...r }) => r) } },
      { id: String(cur.id) },
    );
    expect(again.status).toBe(200);
    const kept = await prisma.attendance.findMany({ where: { sessionId: cur.id } });
    expect(kept.filter((a) => a.homework === "MISSING")).toHaveLength(1);
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: cur.id } })).homework).toBe("Học 10 từ mới");
  });

  it("chặn giá trị chấm bài tập không hợp lệ", async () => {
    const before = await call(getAttendance, "lan", {}, { id: String(cur.id) });
    const r = before.data.roster[0];
    const bad = await call(
      putAttendance,
      "lan",
      { method: "PUT", body: { items: [{ studentId: r.studentId, status: "PRESENT", homework: "XONG" }] } },
      { id: String(cur.id) },
    );
    expect(bad.status).toBe(400);
  });
});

describe("Kế hoạch bài giảng theo lớp", () => {
  it("mỗi buổi có bài theo khung, bài tập đã giao và kết quả chấm", async () => {
    const res = await call(getPlan, "lan", {}, { id: String(classId) });
    expect(res.status).toBe(200);
    const p = res.data.sessions.find((s: { id: number }) => s.id === prev.id);
    expect(p.assignedHomework).toBe("Workbook trang 12");
    expect(p.lesson).not.toBeNull();
    const c = res.data.sessions.find((s: { id: number }) => s.id === cur.id);
    expect(c.assignedHomework).toBe("Học 10 từ mới");
    expect(c.homeworkChecked.missing).toBe(1);
    expect(c.homeworkChecked.checked).toBe(c.roster);
  });

  it("giáo viên không mở được lớp không phải của mình", async () => {
    const res = await call(getPlan, "lan", {}, { id: String(otherClassId) });
    expect(res.status).toBe(404);
    const manager = await call(getPlan, "quanly", {}, { id: String(otherClassId) });
    expect(manager.status).toBe(200);
  });
});
