// Lịch rảnh, ngày nghỉ của giáo viên và bảo lưu của học sinh: logic thuần, có test.
import { isoWeekday, toMinutes } from "./dates";

export type AvailabilitySlot = { weekday: number; startTime: string; endTime: string; centerId: number | null };

/**
 * Buổi `date` `startTime`–`endTime` ở `centerId` có nằm trong lịch rảnh không.
 * - FREE: có một khung rảnh (đúng trung tâm hoặc mọi trung tâm) phủ trọn buổi.
 * - OUTSIDE: đã khai lịch rảnh nhưng buổi này nằm ngoài.
 * - UNKNOWN: chưa khai lịch rảnh nào, không đánh giá được.
 */
export function availabilityFor(
  slots: AvailabilitySlot[],
  date: string,
  startTime: string,
  endTime: string,
  centerId: number,
): "FREE" | "OUTSIDE" | "UNKNOWN" {
  if (slots.length === 0) return "UNKNOWN";
  const wd = isoWeekday(date);
  const ok = slots.some(
    (s) =>
      s.weekday === wd &&
      (s.centerId == null || s.centerId === centerId) &&
      toMinutes(s.startTime) <= toMinutes(startTime) &&
      toMinutes(endTime) <= toMinutes(s.endTime),
  );
  return ok ? "FREE" : "OUTSIDE";
}

/** Gộp các khung trùng hoặc nối tiếp nhau trong cùng thứ, cùng trung tâm; sắp theo thứ rồi giờ. */
export function normalizeSlots<T extends AvailabilitySlot>(slots: T[]): AvailabilitySlot[] {
  const sorted = [...slots].sort(
    (a, b) => a.weekday - b.weekday || (a.centerId ?? 0) - (b.centerId ?? 0) || a.startTime.localeCompare(b.startTime),
  );
  const out: AvailabilitySlot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.weekday === s.weekday && last.centerId === (s.centerId ?? null) && s.startTime <= last.endTime) {
      if (s.endTime > last.endTime) last.endTime = s.endTime;
      continue;
    }
    out.push({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, centerId: s.centerId ?? null });
  }
  return out.sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
}

export type DateRange = { fromDate: string; toDate: string };

/** Ngày `date` nằm trong khoảng nghỉ (tính cả hai đầu). */
export const inRange = (r: DateRange, date: string) => r.fromDate <= date && date <= r.toDate;

/** Hai khoảng ngày có giao nhau. */
export const rangesOverlap = (a: DateRange, b: DateRange) => a.fromDate <= b.toDate && b.fromDate <= a.toDate;

export type ReservationLite = { startDate: string; returnedAt: string | null };

/** Bảo lưu có áp dụng vào ngày `date` không: từ ngày bắt đầu đến trước ngày học lại (chưa học lại thì kéo dài). */
export const reservationCovers = (r: ReservationLite, date: string) => r.startDate <= date && (r.returnedAt == null || date < r.returnedAt);
