// Điểm danh và số buổi còn lại (đặc tả đợt 1, mục 3 và câu hỏi Q6, đang theo mặc định đề xuất):
// - Có mặt, đi muộn: tính là đã học, trừ 1 buổi.
// - Vắng không phép: trừ 1 buổi. Vắng có phép: không trừ.
// - Học bù: trừ vào ghi danh của buổi vắng gốc, nhưng không trừ lần nữa nếu buổi gốc đã bị trừ.

import { COLORS } from "./colors";

export const ATTENDANCE_STATUSES = [
  { value: "PRESENT", label: "Có mặt", short: "Có mặt", color: COLORS.success },
  { value: "LATE", label: "Đi muộn", short: "Muộn", color: COLORS.attention },
  { value: "EXCUSED", label: "Vắng có phép", short: "Vắng CP", color: COLORS.accent },
  { value: "UNEXCUSED", label: "Vắng không phép", short: "Vắng KP", color: COLORS.danger },
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]["value"];

export const attendanceOption = (s: string) => ATTENDANCE_STATUSES.find((o) => o.value === s);

/** Chạm để đổi theo vòng: Có mặt → Muộn → Vắng có phép → Vắng không phép → Có mặt. */
export function nextAttendanceStatus(s: AttendanceStatus): AttendanceStatus {
  const i = ATTENDANCE_STATUSES.findIndex((o) => o.value === s);
  return ATTENDANCE_STATUSES[(i + 1) % ATTENDANCE_STATUSES.length].value;
}

export const isAbsent = (s: string) => s === "EXCUSED" || s === "UNEXCUSED";
export const isAttended = (s: string) => s === "PRESENT" || s === "LATE";

/** Trạng thái này có trừ buổi không. */
export const isCharged = (s: string) => s !== "EXCUSED";

export type ChargeRecord = {
  status: string;
  /** Trạng thái của buổi vắng gốc, nếu đây là buổi học bù. */
  makeupOfStatus?: string | null;
};

/** Số buổi bị trừ của một lượt điểm danh (0 hoặc 1). */
export function chargeOf(r: ChargeRecord): number {
  if (!isCharged(r.status)) return 0;
  if (r.makeupOfStatus != null && isCharged(r.makeupOfStatus)) return 0;
  return 1;
}

export type Balance = { purchased: number; used: number; adjustment: number; remaining: number };

/** Còn lại = đã mua − đã học − vắng không phép ± điều chỉnh. */
export function computeBalance(purchased: number, adjustment: number, records: ChargeRecord[]): Balance {
  const used = records.reduce((n, r) => n + chargeOf(r), 0);
  return { purchased, used, adjustment, remaining: purchased + adjustment - used };
}

/** Còn ≤ 3 buổi thì cảnh báo (DESIGN 5A.3). */
export const LOW_BALANCE = 3;

/** Giờ dạy (phút) của một buổi "HH:mm"–"HH:mm". */
export function sessionMinutes(startTime: string, endTime: string): number {
  const [h1, m1] = startTime.split(":").map(Number);
  const [h2, m2] = endTime.split(":").map(Number);
  return Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
}

/** "90 phút" → "1 giờ 30 phút". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}
