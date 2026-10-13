// B3: lương tính vào chi phí của trung tâm nơi buổi dạy diễn ra, tổng luôn khớp tổng thực nhận.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { payrollCostByCenter } from "@/server/payroll";

let periodId = 0;
let month = "";
let taughtCenterId = 0;

beforeAll(async () => {
  const sessions = await prisma.classSession.findMany({
    where: { status: { not: "CANCELLED" } },
    include: { class: { select: { centerId: true } } },
    orderBy: { date: "desc" },
    take: 300,
  });
  for (const s of sessions) {
    const m = s.date.slice(0, 7);
    const exist = await prisma.payrollPeriod.findUnique({ where: { month_teacherId: { month: m, teacherId: s.teacherId } } });
    if (!exist) {
      month = m;
      taughtCenterId = s.class.centerId;
      const p = await prisma.payrollPeriod.create({
        data: { month: m, teacherId: s.teacherId, centerId: null, status: "DRAFT", totalHours: 10, teachingPay: 1_000_000, bonusPay: 100_000, finalPay: 1_100_000 },
      });
      periodId = p.id;
      return;
    }
  }
  throw new Error("Không có buổi nào để thử");
});

afterAll(async () => {
  if (periodId) await prisma.payrollPeriod.delete({ where: { id: periodId } });
  await prisma.$disconnect();
});

describe("B3: chi phí lương theo trung tâm nơi dạy", () => {
  it("tổng các trung tâm bằng tổng thực nhận của mọi bảng lương trong tháng", async () => {
    const cost = await payrollCostByCenter(month);
    const total = [...cost.values()].reduce((a, b) => a + b, 0);
    const periods = await prisma.payrollPeriod.findMany({ where: { month } });
    expect(total).toBe(periods.reduce((s, p) => s + p.finalPay, 0));
  });

  it("trung tâm nơi buổi dạy diễn ra gánh phần lương, kể cả khi bảng lương không gắn trung tâm", async () => {
    const withIt = await payrollCostByCenter(month);
    await prisma.payrollPeriod.update({ where: { id: periodId }, data: { teachingPay: 0, bonusPay: 0, finalPay: 0 } });
    const without = await payrollCostByCenter(month);
    expect((withIt.get(taughtCenterId) ?? 0) - (without.get(taughtCenterId) ?? 0)).toBeGreaterThan(0);
  });
});