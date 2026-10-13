// B7: doanh thu theo ngày và theo trung tâm học (trung tâm của lớp), tổng luôn khớp doanh thu theo trung tâm thu.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getRevenue } from "@/app/api/reports/revenue/route";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

let token = "";

beforeAll(async () => {
  const u = await prisma.user.findUniqueOrThrow({ where: { username: "quanly" } });
  token = (await createSession(u.id)).token;
});

afterAll(async () => {
  await prisma.userSession.deleteMany({ where: { user: { username: "quanly" } } });
  await prisma.$disconnect();
});

describe("B7: báo cáo doanh thu theo ngày và theo trung tâm học", () => {
  it("tổng theo ngày và theo trung tâm học khớp tổng thực thu, hoàn tiền", async () => {
    const res = await getRevenue(
      new Request("http://localhost/api/reports/revenue?fromMonth=2020-01&toMonth=2099-12", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }),
      {} as never,
    );
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(d.byDay)).toBe(true);
    expect(Array.isArray(d.byLearningCenter)).toBe(true);

    const sum = (rows: Record<string, number>[], key: string) => rows.reduce((s, r) => s + r[key], 0);
    expect(sum(d.byDay, "paid")).toBe(d.summary.totalPaid);
    expect(sum(d.byDay, "refund")).toBe(d.summary.totalRefund);
    expect(sum(d.byLearningCenter, "paidTotal")).toBe(d.summary.totalPaid);
    expect(sum(d.byLearningCenter, "refundTotal")).toBe(d.summary.totalRefund);

    const dates = d.byDay.map((r: { date: string }) => r.date);
    expect([...dates].sort()).toEqual(dates);
    for (const r of d.byDay) expect(r.net).toBe(r.paid - r.refund);
  });

  it("trung tâm học tính theo lớp của ghi danh, không theo nơi thu tiền", async () => {
    const p = await prisma.payment.findFirst({ where: { status: "VALID" }, include: { enrollment: { include: { class: true } } } });
    if (!p) return;
    const res = await getRevenue(
      new Request(`http://localhost/api/reports/revenue?fromMonth=${p.date.slice(0, 7)}&toMonth=${p.date.slice(0, 7)}`, { headers: { cookie: `${SESSION_COOKIE}=${token}` } }),
      {} as never,
    );
    const d = await res.json();
    const row = d.byLearningCenter.find((c: { center: { id: number } }) => c.center.id === p.enrollment.class.centerId);
    expect(row).toBeDefined();
    expect(row.paidTotal).toBeGreaterThanOrEqual(p.amount);
  });
});