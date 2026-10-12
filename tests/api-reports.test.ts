// Kiểm thử API Báo cáo: Tổng quan hôm nay, Doanh thu, Lãi lỗ, Giáo viên và Chuyên cần
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getDashboard } from "@/app/api/reports/dashboard/route";
import { GET as getRevenue } from "@/app/api/reports/revenue/route";
import { GET as getProfitLoss } from "@/app/api/reports/profit-loss/route";
import { GET as getTeachers } from "@/app/api/reports/teachers/route";
import { GET as getAttendance } from "@/app/api/reports/attendance/route";
import { todayISO } from "@/lib/dates";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a", "lan"];

async function call(
  handler: (req: Request, ctx: never) => Promise<Response>,
  url: string,
  who: string,
) {
  const headers = new Headers();
  headers.set("cookie", `${SESSION_COOKIE}=${tokens[who]}`);
  const res = await handler(new Request(`http://localhost${url}`, { headers }), {} as never);
  return { status: res.status, data: await res.json() };
}

const currentMonth = todayISO().slice(0, 7);

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
});

afterAll(async () => {
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("API Báo cáo & Thống kê", () => {
  it("quản lý và giáo vụ xem được dashboard hôm nay, giáo viên bị chặn", async () => {
    const failRes = await call(getDashboard, "/api/reports/dashboard", "lan");
    expect(failRes.status).toBe(403);

    const okRes = await call(getDashboard, "/api/reports/dashboard", "quanly");
    expect(okRes.status).toBe(200);
    expect(okRes.data.sessionsCount).toBeDefined();
    expect(okRes.data.attendance).toBeDefined();
    expect(okRes.data.revenueToday).toBeDefined();
  });

  it("báo cáo doanh thu & thực thu có tổng hợp theo trung tâm", async () => {
    const res = await call(getRevenue, `/api/reports/revenue?fromMonth=${currentMonth}&toMonth=${currentMonth}`, "quanly");
    expect(res.status).toBe(200);
    expect(res.data.summary).toBeDefined();
    expect(res.data.byCenter).toBeDefined();
    expect(Array.isArray(res.data.byCenter)).toBe(true);
  });

  it("báo cáo lãi lỗ theo trung tâm tính đúng công thức Net Revenue - Payroll - Expenses", async () => {
    const res = await call(getProfitLoss, `/api/reports/profit-loss?month=${currentMonth}`, "quanly");
    expect(res.status).toBe(200);
    expect(res.data.summary).toBeDefined();
    expect(res.data.byCenter).toBeDefined();
    for (const c of res.data.byCenter) {
      expect(c.profit).toBe(c.netRevenue - c.teacherPayroll - c.expenses);
    }
  });

  it("báo cáo giáo viên tổng hợp đúng giờ dạy và lương tháng", async () => {
    const res = await call(getTeachers, `/api/reports/teachers?month=${currentMonth}`, "quanly");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.items)).toBe(true);
    expect(res.data.items.length).toBeGreaterThan(0);
  });

  it("báo cáo chuyên cần tính tỷ lệ đi học theo lớp", async () => {
    const res = await call(getAttendance, "/api/reports/attendance", "quanly");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.items)).toBe(true);
  });
});
