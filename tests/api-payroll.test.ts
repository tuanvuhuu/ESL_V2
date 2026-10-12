// Kiểm thử API Lương: Bảng lương tháng, điều chỉnh thưởng phạt, chốt lương và xem lương cá nhân
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getPayroll } from "@/app/api/payroll/route";
import { POST as lockPayroll } from "@/app/api/payroll/[id]/lock/route";
import { POST as payPayroll } from "@/app/api/payroll/[id]/pay/route";
import { POST as postAdjustment } from "@/app/api/payroll/[id]/adjustments/route";
import { GET as getMyPayroll } from "@/app/api/my/payroll/route";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a", "lan", "thu"];

async function call(
  handler: (req: Request, ctx: never) => Promise<Response>,
  url: string,
  who: string,
  init: RequestInit = {},
  params: Record<string, string> = {},
) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE}=${tokens[who]}`);
  const res = await handler(new Request(`http://localhost${url}`, { ...init, headers }), {
    params: Promise.resolve(params),
  } as never);
  return { status: res.status, data: await res.json() };
}

const testMonth = "2099-01";

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  await prisma.payrollPeriod.deleteMany({ where: { month: testMonth } });
});

afterAll(async () => {
  await prisma.payrollPeriod.deleteMany({ where: { month: testMonth } });
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("API Bảng lương tháng", () => {
  it("quản lý lấy được bảng lương tháng của tất cả giáo viên", async () => {
    const res = await call(getPayroll, `/api/payroll?month=${testMonth}`, "quanly");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);

    const first = res.data[0];
    expect(first.teacher).toBeDefined();
    expect(first.period).toBeDefined();
    expect(first.period.status).toBeDefined();
  });

  it("thêm điều chỉnh thưởng/phạt và chốt lương", async () => {
    const listRes = await call(getPayroll, `/api/payroll?month=${testMonth}`, "quanly");
    const period = listRes.data[0].period;
    const periodId = period.id;

    // 1. Thêm khoản thưởng
    const adjRes = await call(
      postAdjustment,
      `/api/payroll/${periodId}/adjustments`,
      "quanly",
      {
        method: "POST",
        body: JSON.stringify({
          type: "BONUS",
          amount: 200000,
          note: "Thưởng chuyên cần",
        }),
      },
      { id: String(periodId) },
    );
    expect(adjRes.status).toBe(200);
    expect(adjRes.data.type).toBe("BONUS");
    expect(adjRes.data.amount).toBe(200000);

    // 2. Giáo vụ không chốt lương được -> 403
    const failLock = await call(lockPayroll, `/api/payroll/${periodId}/lock`, "giaovu.a", { method: "POST" }, { id: String(periodId) });
    expect(failLock.status).toBe(403);

    // 3. Quản lý chốt lương thành công
    const okLock = await call(lockPayroll, `/api/payroll/${periodId}/lock`, "quanly", { method: "POST" }, { id: String(periodId) });
    expect(okLock.status).toBe(200);
    expect(okLock.data.status).toBe("LOCKED");

    // 4. Quản lý đánh dấu đã thanh toán
    const okPay = await call(payPayroll, `/api/payroll/${periodId}/pay`, "quanly", { method: "POST" }, { id: String(periodId) });
    expect(okPay.status).toBe(200);
    expect(okPay.data.status).toBe("PAID");
  });

  it("giáo viên xem được bảng giờ và lương cá nhân của mình", async () => {
    const res = await call(getMyPayroll, `/api/my/payroll?month=${testMonth}`, "lan");
    expect(res.status).toBe(200);
    expect(res.data.teacher).toBeDefined();
    expect(res.data.sessions).toBeDefined();
    expect(res.data.month).toBe(testMonth);
  });
});
