// Học phí gói buổi, giảm giá, công nợ và tiền hoàn tham khảo.
import { describe, expect, it } from "vitest";
import {
  computeDebtStatus,
  computeRefundReference,
  computeTuition,
  DEBT_STATUSES,
  DISCOUNT_TYPES,
  diffDays,
  formatCurrency,
  PAYMENT_METHODS,
} from "@/lib/finance";

describe("học phí gói buổi", () => {
  it("không giảm: học phí gốc bằng đơn giá × số buổi", () => {
    expect(computeTuition({ sessionPrice: 150000, sessionsCount: 24, discountType: "PROMOTION", discountMode: "PERCENT", discountValue: 0 })).toEqual({
      originalFee: 3600000,
      discountAmount: 0,
      finalFee: 3600000,
    });
  });

  it("giảm theo phần trăm, làm tròn tiền giảm", () => {
    expect(
      computeTuition({ sessionPrice: 150000, sessionsCount: 24, discountType: "SIBLING", discountMode: "PERCENT", discountValue: 10 }).finalFee,
    ).toBe(3240000);
    // 1.000.000 × 7,5% = 75.000
    expect(
      computeTuition({ sessionPrice: 1000000, sessionsCount: 1, discountType: "SCHOLARSHIP", discountMode: "PERCENT", discountValue: 7.5 }).discountAmount,
    ).toBe(75000);
  });

  it("giảm theo số tiền", () => {
    const t = computeTuition({ sessionPrice: 150000, sessionsCount: 24, discountType: "EARLY_BIRD", discountMode: "AMOUNT", discountValue: 360000 });
    expect(t).toEqual({ originalFee: 3600000, discountAmount: 360000, finalFee: 3240000 });
  });

  it("giảm số tiền không được vượt học phí gốc và không được âm", () => {
    const over = computeTuition({ sessionPrice: 150000, sessionsCount: 10, discountType: "ALUMNI", discountMode: "AMOUNT", discountValue: 99999999 });
    expect(over).toEqual({ originalFee: 1500000, discountAmount: 1500000, finalFee: 0 });
    const neg = computeTuition({ sessionPrice: 150000, sessionsCount: 10, discountType: "ALUMNI", discountMode: "AMOUNT", discountValue: -500000 });
    expect(neg).toEqual({ originalFee: 1500000, discountAmount: 0, finalFee: 1500000 });
  });
});

describe("công nợ", () => {
  const fee = 3600000;

  it("đóng đủ là Đã hoàn tất, kể cả khi đóng quá hạn", () => {
    expect(computeDebtStatus({ finalFee: fee, paidAmount: fee, dueDate: "2026-10-01", today: "2026-11-01" })).toEqual({
      debtAmount: 0,
      status: "PAID",
      isOverdue: false,
      overdueDays: 0,
    });
    expect(computeDebtStatus({ finalFee: fee, paidAmount: fee + 500000, dueDate: "2026-10-01", today: "2026-10-01" }).debtAmount).toBe(0);
  });

  it("chưa đóng gì, còn hạn là Chưa đóng", () => {
    expect(computeDebtStatus({ finalFee: fee, paidAmount: 0, dueDate: "2026-10-31", today: "2026-10-12" })).toEqual({
      debtAmount: 3600000,
      status: "UNPAID",
      isOverdue: false,
      overdueDays: 0,
    });
  });

  it("đóng một phần, còn hạn là Đang nợ một phần", () => {
    expect(computeDebtStatus({ finalFee: fee, paidAmount: 1000000, dueDate: "2026-10-31", today: "2026-10-12" })).toEqual({
      debtAmount: 2600000,
      status: "PARTIAL",
      isOverdue: false,
      overdueDays: 0,
    });
  });

  it("đến hạn mà chưa đóng đủ vẫn chưa tính quá hạn", () => {
    expect(computeDebtStatus({ finalFee: fee, paidAmount: 1000000, dueDate: "2026-10-12", today: "2026-10-12" }).status).toBe("PARTIAL");
  });

  it("quá hạn thì tính số ngày quá hạn", () => {
    expect(computeDebtStatus({ finalFee: fee, paidAmount: 1000000, dueDate: "2026-10-01", today: "2026-10-11" })).toEqual({
      debtAmount: 2600000,
      status: "OVERDUE",
      isOverdue: true,
      overdueDays: 10,
    });
    // Quá hạn qua tháng, năm.
    expect(computeDebtStatus({ finalFee: fee, paidAmount: 0, dueDate: "2026-12-28", today: "2027-01-05" }).overdueDays).toBe(8);
  });

  it("số ngày giữa hai ngày", () => {
    expect(diffDays("2026-10-01", "2026-10-11")).toBe(10);
    expect(diffDays("2026-11-01", "2026-10-01")).toBe(-31);
    expect(diffDays("2026-10-12", "2026-10-12")).toBe(0);
  });
});

describe("tiền hoàn tham khảo", () => {
  it("đổi theo số buổi chưa học", () => {
    // 3.240.000 / 24 buổi = 135.000 mỗi buổi.
    expect(computeRefundReference({ finalFee: 3240000, purchasedSessions: 24, unusedSessions: 4 })).toBe(540000);
    expect(computeRefundReference({ finalFee: 3600000, purchasedSessions: 12, unusedSessions: 12 })).toBe(3600000);
    expect(computeRefundReference({ finalFee: 3600000, purchasedSessions: 12, unusedSessions: 0 })).toBe(0);
  });

  it("làm tròn về đồng", () => {
    expect(computeRefundReference({ finalFee: 1000000, purchasedSessions: 3, unusedSessions: 1 })).toBe(333333);
  });

  it("không mua buổi nào thì hoàn 0, không chia 0", () => {
    expect(computeRefundReference({ finalFee: 3600000, purchasedSessions: 0, unusedSessions: 5 })).toBe(0);
  });
});

describe("định dạng tiền", () => {
  it("dấu chấm ngăn cách nhóm và ký hiệu ₫", () => {
    expect(formatCurrency(1500000)).toBe("1.500.000 ₫");
    expect(formatCurrency(0)).toBe("0 ₫");
    expect(formatCurrency(360000)).toBe("360.000 ₫");
    expect(formatCurrency(999)).toBe("999 ₫");
  });
});

describe("danh mục", () => {
  it("có đủ loại giảm, phương thức thanh toán và trạng thái công nợ", () => {
    expect(DISCOUNT_TYPES.map((d) => d.value)).toEqual(["SIBLING", "ALUMNI", "EARLY_BIRD", "SCHOLARSHIP", "PROMOTION"]);
    expect(DISCOUNT_TYPES.find((d) => d.value === "EARLY_BIRD")?.label).toBe("Đóng sớm");
    expect(PAYMENT_METHODS.map((p) => p.value)).toEqual(["CASH", "TRANSFER"]);
    expect(DEBT_STATUSES.map((s) => s.label)).toEqual(["Đã hoàn tất", "Đang nợ một phần", "Chưa đóng", "Quá hạn"]);
  });
});