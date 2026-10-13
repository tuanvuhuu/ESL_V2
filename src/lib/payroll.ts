// Lương theo giờ dạy và cách tính khi đứng nhiều lớp trùng giờ (Tổng quan yêu cầu mục 3.7).
// Logic thuần, không đụng database: dùng chung cho màn hình lương, API và báo cáo.
// - Tiền một buổi = số giờ dạy × đơn giá giờ theo vai trò (giáo viên / trợ giảng).
// - Buổi trùng giờ (cùng ngày, cùng trung tâm) áp 1 trong 3 cách: tính 1 lần, tính đủ từng lớp,
//   tính theo hệ số.
// - Điều chỉnh: cộng thưởng và phụ cấp, trừ phạt.

import { sessionMinutes } from "./attendance";
import { toMinutes } from "./dates";
import { COLORS } from "./colors";

/** Cách tính tiền cho các buổi trùng giờ trong cùng một ngày, cùng trung tâm. */
export const OVERLAP_POLICIES = [
  {
    value: "SINGLE",
    label: "Tính 1 lần",
    color: COLORS.done,
    hint: "Các buổi trùng nhau chia đều tiền của một buổi.",
  },
  {
    value: "FULL",
    label: "Tính đủ từng lớp",
    color: COLORS.accent,
    hint: "Mỗi buổi trùng nhau đều tính đủ.",
  },
  {
    value: "RATIO",
    label: "Tính theo hệ số",
    color: COLORS.teal,
    hint: "Nhân thêm hệ số rồi chia đều cho các buổi trùng nhau.",
  },
] as const;

export type OverlapPolicy = (typeof OVERLAP_POLICIES)[number]["value"];

export const overlapPolicyOption = (v: string) => OVERLAP_POLICIES.find((o) => o.value === v);

/** Hệ số mặc định khi chọn cách tính theo hệ số. */
export const DEFAULT_OVERLAP_RATIO = 1.5;

/** Trạng thái bảng lương: nháp → chốt → đã thanh toán. */
export const PAYROLL_STATUSES = [
  { value: "DRAFT", label: "Bản nháp", color: COLORS.neutral },
  { value: "LOCKED", label: "Đã chốt", color: COLORS.accent },
  { value: "PAID", label: "Đã thanh toán", color: COLORS.success },
] as const;

export type PayrollStatus = (typeof PAYROLL_STATUSES)[number]["value"];

export const payrollStatusOption = (v: string) => PAYROLL_STATUSES.find((o) => o.value === v);

/** Khoản điều chỉnh lương: thưởng và phụ cấp được cộng, phạt bị trừ. */
export const ADJUSTMENT_TYPES = [
  { value: "BONUS", label: "Thưởng", color: COLORS.success },
  { value: "ALLOWANCE", label: "Phụ cấp", color: COLORS.accent },
  { value: "PENALTY", label: "Phạt", color: COLORS.danger },
] as const;

export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number]["value"];

export const adjustmentTypeOption = (v: string) => ADJUSTMENT_TYPES.find((o) => o.value === v);

export type TeachingRole = "TEACHER" | "ASSISTANT";

/** Một buổi dạy của giáo viên / trợ giảng, đủ để tính tiền theo giờ. */
export type TeachingSession = {
  sessionId: number;
  date: string;
  startTime: string;
  endTime: string;
  centerId: number;
  role: TeachingRole;
  hourlyRate: number;
  /** Ghi đè thời lượng khi buổi học bị rút ngắn hoặc kéo dài. */
  durationMinutes?: number;
  /** B4: cách tính trùng giờ theo ngày hiệu lực của buổi này; trống thì dùng cách chung của cả bảng lương. */
  overlapPolicy?: OverlapPolicy;
  overlapRatio?: number;
};

/** Khoản cộng / trừ thêm ngoài tiền dạy. */
export type SalaryAdjustment = {
  type: AdjustmentType;
  amount: number;
  note: string;
};

/** Số phút dạy của một buổi: ưu tiên `durationMinutes`, không có thì lấy từ giờ bắt đầu và kết thúc. */
export function sessionDuration(session: TeachingSession): number {
  return Math.max(0, session.durationMinutes ?? sessionMinutes(session.startTime, session.endTime));
}

/** Số giờ dạy của một buổi (chưa áp cách tính khi trùng giờ). */
export function sessionHours(session: TeachingSession): number {
  return sessionDuration(session) / 60;
}

/** Tiền một buổi nếu không trùng giờ: số giờ × đơn giá giờ, làm tròn về đồng. */
export function sessionBasePay(session: TeachingSession): number {
  return Math.round(sessionHours(session) * Math.max(0, session.hourlyRate));
}

/** Hệ số dùng cho cách tính theo hệ số; hệ số không hợp lệ thì lấy hệ số mặc định. */
function ratioOrDefault(ratioValue?: number): number {
  return ratioValue != null && Number.isFinite(ratioValue) && ratioValue > 0 ? ratioValue : DEFAULT_OVERLAP_RATIO;
}

/**
 * Gom các buổi trùng giờ trong từng ngày thành nhóm liên thông: A trùng B, B trùng C thì cả ba
 * vào một nhóm dù A và C không chạm nhau. Chỉ trả về nhóm từ 2 buổi trở lên.
 * Quy tắc mục 5 đã chặn một người dạy hai trung tâm trùng giờ, nên không cần tách theo trung tâm.
 */
export function detectOverlappingSessions(sessions: TeachingSession[]): TeachingSession[][] {
  const byDate = new Map<string, TeachingSession[]>();
  for (const s of sessions) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }
  const groups: TeachingSession[][] = [];
  for (const list of byDate.values()) {
    const sorted = [...list].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
    let group: TeachingSession[] = [];
    let maxEnd = 0;
    const flush = () => {
      if (group.length > 1) groups.push(group);
      group = [];
      maxEnd = 0;
    };
    for (const s of sorted) {
      // Buổi bắt đầu đúng lúc nhóm kết thúc thì không trùng, mở nhóm mới.
      if (group.length > 0 && toMinutes(s.startTime) >= maxEnd) flush();
      group.push(s);
      maxEnd = Math.max(maxEnd, toMinutes(s.endTime));
    }
    flush();
  }
  return groups.sort((a, b) => a[0].date.localeCompare(b[0].date) || a[0].startTime.localeCompare(b[0].startTime));
}

/** Số buổi trong nhóm trùng giờ của từng buổi (1 nếu không trùng). */
export function overlapCounts(sessions: TeachingSession[]): Map<number, number> {
  const counts = new Map<number, number>(sessions.map((s) => [s.sessionId, 1]));
  for (const group of detectOverlappingSessions(sessions)) {
    for (const s of group) counts.set(s.sessionId, group.length);
  }
  return counts;
}

/**
 * Tiền của một buổi đã áp cách tính khi trùng giờ.
 * - Không trùng (hoặc `overlapCount` < 2): tính đủ.
 * - SINGLE: chia đều, cả nhóm trùng bằng tiền một buổi.
 * - FULL: tính đủ cho từng lớp.
 * - RATIO: nhân thêm hệ số (mặc định 1,5) rồi chia đều cho các buổi trùng.
 */
export function computeSessionPay(
  session: TeachingSession,
  overlapCount: number,
  policy: OverlapPolicy,
  ratioValue?: number,
): number {
  const base = sessionBasePay(session);
  const count = Math.max(1, Math.floor(overlapCount));
  if (count <= 1) return base;
  if (policy === "FULL") return base;
  if (policy === "RATIO") return Math.round((sessionHours(session) * Math.max(0, session.hourlyRate) * ratioOrDefault(ratioValue)) / count);
  return Math.round(base / count);
}

/** Chi tiết từng buổi trong bảng lương, để hiển thị và in phiếu lương. */
export type SessionPayDetail = {
  sessionId: number;
  date: string;
  startTime: string;
  endTime: string;
  centerId: number;
  role: TeachingRole;
  hours: number;
  /** Tiền nếu không trùng giờ. */
  basePay: number;
  /** Số buổi trùng giờ cùng ngày, gồm cả buổi này. */
  overlapCount: number;
  /** Tiền thực nhận sau khi áp cách tính trùng giờ. */
  pay: number;
};

export type MonthlySalaryInput = {
  sessions: TeachingSession[];
  /** Cách tính các buổi trùng giờ, mặc định SINGLE. */
  overlapPolicy?: OverlapPolicy;
  /** Hệ số khi chọn RATIO, mặc định 1,5. */
  defaultRatio?: number;
  adjustments?: SalaryAdjustment[];
};

export type MonthlySalary = {
  /** Tổng số giờ dạy trong kỳ (làm tròn 2 chữ số thập phân). */
  totalHours: number;
  /** Tổng tiền dạy sau khi áp cách tính trùng giờ. */
  teachingPay: number;
  /** Tổng điều chỉnh: thưởng + phụ cấp − phạt. */
  adjustmentTotal: number;
  /** Tổng lương thực nhận = tiền dạy + điều chỉnh. */
  finalSalary: number;
  sessionDetails: SessionPayDetail[];
};

/** Tổng lương tháng: số giờ, tiền dạy, các khoản điều chỉnh và tổng thực nhận. */
export function computeMonthlySalary({
  sessions,
  overlapPolicy = "SINGLE",
  defaultRatio,
  adjustments = [],
}: MonthlySalaryInput): MonthlySalary {
  const counts = overlapCounts(sessions);
  const details: SessionPayDetail[] = sessions.map((s) => {
    const overlapCount = counts.get(s.sessionId) ?? 1;
    return {
      sessionId: s.sessionId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      centerId: s.centerId,
      role: s.role,
      hours: sessionHours(s),
      basePay: sessionBasePay(s),
      overlapCount,
      pay: computeSessionPay(s, overlapCount, s.overlapPolicy ?? overlapPolicy, s.overlapRatio ?? defaultRatio),
    };
  });
  const totalHours = Math.round(details.reduce((n, d) => n + d.hours, 0) * 100) / 100;
  const teachingPay = details.reduce((n, d) => n + d.pay, 0);
  const adjustmentTotal = adjustments.reduce((n, a) => (a.type === "PENALTY" ? n - a.amount : n + a.amount), 0);
  return { totalHours, teachingPay, adjustmentTotal, finalSalary: teachingPay + adjustmentTotal, sessionDetails: details };
}

/** "2 giờ 30 phút dạy · 2 buổi trùng giờ" — tóm tắt một buổi trong bảng lương. */
export function sessionPayLine(detail: SessionPayDetail, policy: OverlapPolicy): string {
  const parts = [`${formatHours(detail.hours)} dạy`];
  if (detail.overlapCount > 1) parts.push(`trùng ${detail.overlapCount} lớp (${overlapPolicyOption(policy)?.label ?? policy})`);
  return parts.join(" · ");
}

/** "2,5" → "2 giờ 30 phút". */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}
