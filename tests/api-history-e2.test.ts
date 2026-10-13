// E2: trang lịch sử học tập theo khóa: dữ liệu từng buổi kèm bài theo khung, bài tập, điểm; quyền xem.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getHistory } from "@/app/api/students/[id]/history/route";
import { buildCourseHistory, skillAverages, type HistoryScore } from "@/lib/history";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "lan"];

async function call(who: string, id: number) {
  const res = await getHistory(new Request("http://localhost/x", { headers: { cookie: `${SESSION_COOKIE}=${tokens[who]}` } }), {
    params: Promise.resolve({ id: String(id) }),
  } as never);
  return { status: res.status, data: await res.json() };
}

const score = (p: Partial<HistoryScore>): HistoryScore => ({
  id: 1,
  kind: "QUIZ",
  listening: null,
  speaking: null,
  reading: null,
  writing: null,
  total: null,
  note: null,
  session: { index: 1, date: "2026-10-01", class: { code: "X" } },
  ...p,
});

describe("Điểm trung bình theo kỹ năng", () => {
  it("bỏ qua ô trống, làm tròn 1 chữ số", () => {
    const avg = skillAverages([score({ listening: 7, total: 7 }), score({ listening: 8.5, speaking: 6, total: 7.2 })]);
    expect(avg.find((a) => a.key === "listening")).toMatchObject({ value: 7.8, count: 2 });
    expect(avg.find((a) => a.key === "speaking")).toMatchObject({ value: 6, count: 1 });
    expect(avg.find((a) => a.key === "reading")).toMatchObject({ value: null, count: 0 });
    expect(avg.find((a) => a.key === "total")?.value).toBe(7.1);
  });
});

let studentId = 0;
let otherStudentId = 0;
let attendanceId = 0;
let oldHomework: string | null = null;

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  const lan = await prisma.teacher.findFirstOrThrow({ where: { displayName: "Ms Lan" } });
  const a = await prisma.attendance.findFirstOrThrow({
    where: { enrollment: { leftAt: null, class: { teacherId: lan.id, courseId: { not: null } } } },
    orderBy: { id: "asc" },
  });
  attendanceId = a.id;
  oldHomework = a.homework;
  studentId = a.studentId;
  await prisma.attendance.update({ where: { id: a.id }, data: { homework: "PARTIAL" } });
  const other = await prisma.student.findFirstOrThrow({
    where: { enrollments: { some: {} }, NOT: { enrollments: { some: { class: { OR: [{ teacherId: lan.id }, { assistants: { some: { teacherId: lan.id } } }, { sessions: { some: { teacherId: lan.id } } }] } } } } },
  });
  otherStudentId = other.id;
});

afterAll(async () => {
  await prisma.attendance.update({ where: { id: attendanceId }, data: { homework: oldHomework } });
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("API lịch sử học tập", () => {
  it("mỗi buổi có bài theo khung và kết quả bài tập; khóa có tỉ lệ bài tập", async () => {
    const res = await call("lan", studentId);
    expect(res.status).toBe(200);
    const att = res.data.enrollments.flatMap((e: { attendances: { id: number }[] }) => e.attendances).find((x: { id: number }) => x.id === attendanceId);
    expect(att.homework).toBe("PARTIAL");
    expect(att.session.id).toBeGreaterThan(0);
    expect(att).toHaveProperty("lesson");
    const runs = buildCourseHistory(res.data.enrollments);
    expect(runs.some((r) => r.homework.partial >= 1)).toBe(true);
  });

  it("giáo viên không xem được học sinh không học lớp mình; quản lý xem được", async () => {
    expect((await call("lan", otherStudentId)).status).toBe(404);
    expect((await call("quanly", otherStudentId)).status).toBe(200);
  });
});
