// Kiểm thử API Tài chính: Lập phiếu thu, hủy phiếu, theo dõi công nợ và chi phí
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as postPayment } from "@/app/api/finance/payments/route";
import { POST as cancelPayment } from "@/app/api/finance/payments/[id]/cancel/route";
import { GET as getDebts } from "@/app/api/finance/debts/route";
import { GET as getExpenses, POST as postExpense } from "@/app/api/finance/expenses/route";
import { DELETE as deleteExpense } from "@/app/api/finance/expenses/[id]/route";
import { todayISO } from "@/lib/dates";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a", "giaovu.b", "lan"];

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

let centerAId = 0;
let enrollmentAId = 0;

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }
  const centerA = await prisma.center.findUniqueOrThrow({ where: { code: "A" } });
  centerAId = centerA.id;

  const enrollment = await prisma.classEnrollment.findFirstOrThrow({
    where: { class: { centerId: centerAId }, leftAt: null },
  });
  enrollmentAId = enrollment.id;
});

afterAll(async () => {
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("API Thu học phí và Công nợ", () => {
  it("giáo vụ A thu tiền cho học sinh trung tâm A thành công, giáo vụ B bị chặn", async () => {
    // Giáo vụ B cố thu cho lớp ở Trung tâm A -> 403
    const failRes = await call(
      postPayment,
      "/api/finance/payments",
      "giaovu.b",
      {
        method: "POST",
        body: JSON.stringify({
          enrollmentId: enrollmentAId,
          amount: 1500000,
          date: todayISO(),
          method: "CASH",
          note: "Đợt 1",
        }),
      },
    );
    expect(failRes.status).toBe(403);

    // Giáo vụ A thu hợp lệ
    const okRes = await call(
      postPayment,
      "/api/finance/payments",
      "giaovu.a",
      {
        method: "POST",
        body: JSON.stringify({
          enrollmentId: enrollmentAId,
          amount: 1500000,
          date: todayISO(),
          method: "CASH",
          note: "Học phí đợt 1",
        }),
      },
    );
    expect(okRes.status).toBe(200);
    expect(okRes.data.code).toMatch(/^PT-\d{6}-\d{4}$/);
    expect(okRes.data.amount).toBe(1500000);
    expect(okRes.data.status).toBe("VALID");

    const paymentId = okRes.data.id;

    // Hủy phiếu thu kèm lý do
    const cancelRes = await call(
      cancelPayment,
      `/api/finance/payments/${paymentId}/cancel`,
      "giaovu.a",
      {
        method: "POST",
        body: JSON.stringify({ reason: "Nhập nhầm số tiền" }),
      },
      { id: String(paymentId) },
    );
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.data.status).toBe("CANCELLED");
    expect(cancelRes.data.cancelReason).toBe("Nhập nhầm số tiền");
  });

  it("tra cứu danh sách công nợ có đầy đủ số liệu và trạng thái", async () => {
    const res = await call(getDebts, `/api/finance/debts?centerId=${centerAId}`, "quanly");
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();
    expect(res.data.summary).toBeDefined();
    expect(res.data.summary.totalCount).toBeGreaterThan(0);
  });
});

describe("API Quản lý chi phí", () => {
  it("thêm khoản chi và xóa khoản chi", async () => {
    const createRes = await call(
      postExpense,
      "/api/finance/expenses",
      "giaovu.a",
      {
        method: "POST",
        body: JSON.stringify({
          centerId: centerAId,
          category: "UTILITIES",
          amount: 450000,
          date: todayISO(),
          payer: "Giáo vụ A",
          note: "Tiền điện nước",
        }),
      },
    );
    expect(createRes.status).toBe(200);
    expect(createRes.data.code).toMatch(/^CP-\d{6}-\d{4}$/);
    expect(createRes.data.amount).toBe(450000);

    const expenseId = createRes.data.id;

    const listRes = await call(getExpenses, `/api/finance/expenses?centerId=${centerAId}`, "quanly");
    expect(listRes.status).toBe(200);
    expect(listRes.data.some((e: { id: number }) => e.id === expenseId)).toBe(true);

    const delRes = await call(deleteExpense, `/api/finance/expenses/${expenseId}`, "giaovu.a", { method: "DELETE" }, { id: String(expenseId) });
    expect(delRes.status).toBe(200);
  });
});
