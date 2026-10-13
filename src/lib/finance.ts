// Học phí gói buổi, giảm giá, công nợ và tiền hoàn tham khảo (Tổng quan yêu cầu mục 3.7, quy tắc mục 5).
// Logic thuần, không đụng database: dùng chung cho màn hình, API và báo cáo.
// - Học phí gói = đơn giá buổi × số buổi, trừ giảm giá (theo % hoặc theo số tiền).
// - Công nợ = học phí sau giảm − đã đóng; quá hạn khi hôm nay đã qua hạn mà vẫn còn nợ.
// - Tiền hoàn chỉ mang tính tham khảo: đổi theo số buổi chưa học / số buổi đã mua.

import { parseISODate } from "./dates";
import { COLORS } from "./colors";

export const DISCOUNT_TYPES = [
  { value: "SIBLING", label: "Anh chị em ruột", color: COLORS.done },
  { value: "ALUMNI", label: "Học sinh cũ", color: COLORS.accent },
  { value: "EARLY_BIRD", label: "Đóng sớm", color: COLORS.teal },
  { value: "SCHOLARSHIP", label: "Học bổng", color: COLORS.attention },
  { value: "PROMOTION", label: "Khuyến mãi", color: COLORS.neutral },
] as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[number]["value"];

/** Cách tính giảm: theo phần trăm hay theo số tiền cụ thể. */
export const DISCOUNT_MODES = [
  { value: "PERCENT", label: "Theo %" },
  { value: "AMOUNT", label: "Theo số tiền" },
] as const;

export type DiscountMode = (typeof DISCOUNT_MODES)[number]["value"];

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Tiền mặt", color: COLORS.attention },
  { value: "TRANSFER", label: "Chuyển khoản", color: COLORS.accent },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const DEBT_STATUSES = [
  { value: "PAID", label: "Đã hoàn tất", color: COLORS.success },
  { value: "PARTIAL", label: "Đang nợ một phần", color: COLORS.attention },
  { value: "UNPAID", label: "Chưa đóng", color: COLORS.neutral },
  { value: "OVERDUE", label: "Quá hạn", color: COLORS.danger },
] as const;

export type DebtStatus = (typeof DEBT_STATUSES)[number]["value"];

export const discountOption = (v: string) => DISCOUNT_TYPES.find((o) => o.value === v);
export const paymentOption = (v: string) => PAYMENT_METHODS.find((o) => o.value === v);
export const debtStatusOption = (v: string) => DEBT_STATUSES.find((o) => o.value === v);

export type TuitionInput = {
  /** Đơn giá một buổi. */
  sessionPrice: number;
  /** Số buổi trong gói. */
  sessionsCount: number;
  /** Lý do giảm; không ảnh hưởng đến công thức, chỉ để lưu kèm. */
  discountType: DiscountType;
  discountMode: DiscountMode;
  /** Mức giảm: phần trăm nếu PERCENT, số tiền nếu AMOUNT. */
  discountValue: number;
};

export type Tuition = {
  /** Học phí gốc trước giảm. */
  originalFee: number;
  /** Số tiền được giảm. */
  discountAmount: number;
  /** Học phí phải đóng. */
  finalFee: number;
};

/** Học phí gói buổi sau giảm; giảm theo số tiền không bao giờ vượt học phí gốc. */
export function computeTuition({ sessionPrice, sessionsCount, discountMode, discountValue }: TuitionInput): Tuition {
  const originalFee = sessionPrice * sessionsCount;
  const discountAmount =
    discountMode === "PERCENT" ? Math.round(originalFee * (discountValue / 100)) : Math.min(originalFee, Math.max(0, discountValue));
  return { originalFee, discountAmount, finalFee: originalFee - discountAmount };
}

export type DebtInput = {
  /** Học phí phải đóng sau giảm. */
  finalFee: number;
  /** Số tiền đã đóng. */
  paidAmount: number;
  /** Hạn đóng "YYYY-MM-DD"; trống thì không tính quá hạn. */
  dueDate: string | null;
  /** Ngày tính "YYYY-MM-DD". */
  today: string;
};

export type Debt = {
  /** Số tiền còn nợ, không âm. */
  debtAmount: number;
  status: DebtStatus;
  isOverdue: boolean;
  /** Số ngày quá hạn (0 nếu chưa quá hạn). */
  overdueDays: number;
};

/** Số ngày từ `from` đến `to` (dương khi `to` sau `from`). */
export function diffDays(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86400000);
}

/**
 * Trạng thái công nợ: đã đóng đủ → PAID; còn nợ và quá hạn → OVERDUE kèm số ngày quá hạn;
 * còn nợ mới đóng một phần → PARTIAL; chưa đóng gì → UNPAID.
 */
export function computeDebtStatus({ finalFee, paidAmount, dueDate, today }: DebtInput): Debt {
  const debtAmount = Math.max(0, finalFee - paidAmount);
  if (debtAmount === 0) return { debtAmount, status: "PAID", isOverdue: false, overdueDays: 0 };
  if (dueDate && today > dueDate) {
    return { debtAmount, status: "OVERDUE", isOverdue: true, overdueDays: diffDays(dueDate, today) };
  }
  return { debtAmount, status: paidAmount > 0 ? "PARTIAL" : "UNPAID", isOverdue: false, overdueDays: 0 };
}

export type RefundInput = {
  /** Học phí thực trả sau giảm. */
  finalFee: number;
  /** Số buổi đã mua. */
  purchasedSessions: number;
  /** Số buổi chưa học. */
  unusedSessions: number;
};

/** Số tiền hoàn tham khảo theo tỉ lệ buổi chưa học; không mua buổi nào thì hoàn 0. */
export function computeRefundReference({ finalFee, purchasedSessions, unusedSessions }: RefundInput): number {
  if (purchasedSessions <= 0) return 0;
  return Math.round(unusedSessions * (finalFee / purchasedSessions));
}

/** "1500000" → "1.500.000 ₫". */
export function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")} ₫`;
}