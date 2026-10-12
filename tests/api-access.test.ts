// Kiểm tra phân quyền ở tầng API trên dữ liệu mẫu (cần chạy `npm run db:push && npm run db:seed` trước).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getParents } from "@/app/api/parents/route";
import { GET as getSchedule } from "@/app/api/schedule/route";
import { GET as getStudent, PUT as putStudent } from "@/app/api/students/[id]/route";
import { GET as getStudents } from "@/app/api/students/route";
import { GET as getUsers } from "@/app/api/users/route";
import { POST as login } from "@/app/api/auth/login/route";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};

async function call(handler: (req: Request, ctx: never) => Promise<Response>, url: string, who?: string, init: RequestInit = {}, params?: Record<string, string>) {
  const headers = new Headers(init.headers);
  if (who) headers.set("cookie", `${SESSION_COOKIE}=${tokens[who]}`);
  const res = await handler(new Request(`http://localhost${url}`, { ...init, headers }), { params: Promise.resolve(params ?? {}) } as never);
  return { status: res.status, data: await res.json(), headers: res.headers };
}

beforeAll(async () => {
  for (const username of ["quanly", "giaovu.a", "lan", "thu"]) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
});

afterAll(async () => {
  await prisma.userSession.deleteMany({ where: { user: { username: { in: [...Object.keys(tokens), "giaovu.b"] } } } });
  await prisma.$disconnect();
});

describe("đăng nhập", () => {
  it("chưa đăng nhập thì API trả 401", async () => {
    expect((await call(getStudents, "/api/students")).status).toBe(401);
  });

  it("sai mật khẩu bị từ chối, đúng thì nhận cookie phiên", async () => {
    const bad = await call(login, "/api/auth/login", undefined, { method: "POST", body: JSON.stringify({ username: "giaovu.b", password: "sai-mat-khau" }) });
    expect(bad.status).toBe(401);
    const ok = await call(login, "/api/auth/login", undefined, { method: "POST", body: JSON.stringify({ username: "GiaoVu.B", password: "matkhau123" }) });
    expect(ok.status).toBe(200);
    expect(ok.data.role).toBe("OFFICE");
    expect(ok.headers.get("set-cookie")).toMatch(/esl_session=.+HttpOnly/);
  });
});

describe("phạm vi dữ liệu", () => {
  it("giáo viên chỉ thấy học sinh lớp mình và không thấy SĐT phụ huynh", async () => {
    const all = await call(getStudents, "/api/students?pageSize=500", "quanly");
    const mine = await call(getStudents, "/api/students?pageSize=500", "lan");
    expect(mine.status).toBe(200);
    expect(mine.data.total).toBeGreaterThan(0);
    expect(mine.data.total).toBeLessThan(all.data.total);
    for (const s of mine.data.items) for (const g of s.guardians) expect(g.parent.phone).toBe("");
  });

  it("giáo viên không mở được học sinh lớp khác, không vào được danh sách phụ huynh", async () => {
    const lan = await prisma.user.findUniqueOrThrow({ where: { username: "lan" } });
    const other = await prisma.student.findFirstOrThrow({
      where: { enrollments: { none: { leftAt: null, class: { OR: [{ teacherId: lan.teacherId! }, { assistants: { some: { teacherId: lan.teacherId! } } }] } } } },
    });
    expect((await call(getStudent, `/api/students/${other.id}`, "lan", {}, { id: String(other.id) })).status).toBe(404);
    expect((await call(getParents, "/api/parents", "lan")).status).toBe(403);
  });

  it("lịch của trợ giảng chỉ gồm buổi của lớp mình", async () => {
    const thu = await prisma.user.findUniqueOrThrow({ where: { username: "thu" } });
    const today = new Date().toISOString().slice(0, 10);
    const week = await call(getSchedule, `/api/schedule?from=${today}&to=${today.slice(0, 8)}28`, "thu");
    expect(week.status).toBe(200);
    for (const s of week.data) {
      const mine = s.teacher.id === thu.teacherId || s.class.assistants.some((a: { teacher: { id: number } }) => a.teacher.id === thu.teacherId);
      expect(mine).toBe(true);
    }
  });

  it("giáo vụ xem được học sinh trung tâm khác nhưng không sửa được", async () => {
    const office = await prisma.user.findUniqueOrThrow({ where: { username: "giaovu.a" } });
    const other = await prisma.student.findFirstOrThrow({ where: { centerId: { not: office.centerId! } } });
    const own = await prisma.student.findFirstOrThrow({ where: { centerId: office.centerId! } });
    const view = await call(getStudent, `/api/students/${other.id}`, "giaovu.a", {}, { id: String(other.id) });
    expect(view.status).toBe(200);
    expect(view.data.guardians[0].parent.phone).not.toBe("");

    const payload = (s: typeof own) => ({
      fullName: s.fullName,
      englishName: s.englishName,
      dob: s.dob,
      gender: s.gender,
      audience: s.audience,
      school: s.school,
      schoolGrade: s.schoolGrade,
      centerId: s.centerId,
      level: s.level,
      note: s.note,
    });
    const denied = await call(putStudent, `/api/students/${other.id}`, "giaovu.a", { method: "PUT", body: JSON.stringify(payload(other)) }, { id: String(other.id) });
    expect(denied.status).toBe(403);
    const allowed = await call(putStudent, `/api/students/${own.id}`, "giaovu.a", { method: "PUT", body: JSON.stringify(payload(own)) }, { id: String(own.id) });
    expect(allowed.status).toBe(200);
  });

  it("chỉ quản lý xem được danh sách tài khoản", async () => {
    expect((await call(getUsers, "/api/users", "giaovu.a")).status).toBe(403);
    expect((await call(getUsers, "/api/users", "quanly")).status).toBe(200);
  });
});
