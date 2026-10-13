// Phép tính thuần cho báo cáo học sinh và báo cáo sử dụng phòng / lớp (Tổng quan yêu cầu mục 3.8).
import { addDays, toMinutes } from "./dates";

/** "2026-10" → ["2026-10-01", "2026-10-31"]. */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

/** Các ngày từ `from` đến `to`, tính cả hai đầu. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Tỷ lệ phần trăm làm tròn; mẫu bằng 0 thì trả về null (không có dữ liệu). */
export const percent = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);

export type EnrollmentLite = { id: number; studentId: number; joinedAt: string; transferredFromId: number | null };

/**
 * Tỷ lệ học tiếp: trong các ghi danh kết thúc khóa ở kỳ báo cáo, bao nhiêu học sinh đã có ghi danh mới
 * (không tính chuyển lớp) bắt đầu sau ghi danh đã kết thúc.
 */
export function computeRetention(ended: EnrollmentLite[], all: EnrollmentLite[]) {
  const continued = ended.filter((e) =>
    all.some((f) => f.studentId === e.studentId && f.id !== e.id && !f.transferredFromId && f.joinedAt > e.joinedAt),
  );
  return { ended: ended.length, continued: continued.length, rate: percent(continued.length, ended.length) };
}

/** Khung giờ để xem phòng trống vào lúc nào. */
export const DAY_PARTS = [
  { key: "morning", label: "Sáng", from: "08:00", to: "12:00" },
  { key: "afternoon", label: "Chiều", from: "12:00", to: "17:00" },
  { key: "evening", label: "Tối", from: "17:00", to: "21:00" },
] as const;

export type DayPartKey = (typeof DAY_PARTS)[number]["key"];

/** Số phút trùng nhau giữa hai khoảng giờ "HH:mm". */
export function overlapMinutes(aFrom: string, aTo: string, bFrom: string, bTo: string): number {
  return Math.max(0, Math.min(toMinutes(aTo), toMinutes(bTo)) - Math.max(toMinutes(aFrom), toMinutes(bFrom)));
}

export type RoomSession = { roomId: number; startTime: string; endTime: string };

/**
 * Tỷ lệ sử dụng một phòng theo từng khung giờ: phút có buổi học / (độ dài khung × số ngày mở cửa).
 * Hai buổi chồng nhau trong cùng phòng (không nên có) vẫn chỉ tính tối đa 100%.
 */
export function roomUsage(sessions: RoomSession[], openDays: number) {
  const parts = Object.fromEntries(
    DAY_PARTS.map((p) => {
      const capacity = (toMinutes(p.to) - toMinutes(p.from)) * openDays;
      const used = sessions.reduce((sum, s) => sum + overlapMinutes(s.startTime, s.endTime, p.from, p.to), 0);
      return [p.key, Math.min(100, percent(used, capacity) ?? 0)];
    }),
  ) as Record<DayPartKey, number>;
  const capacity = DAY_PARTS.reduce((s, p) => s + toMinutes(p.to) - toMinutes(p.from), 0) * openDays;
  const used = sessions.reduce((sum, s) => sum + DAY_PARTS.reduce((t, p) => t + overlapMinutes(s.startTime, s.endTime, p.from, p.to), 0), 0);
  return { hours: Math.round((used / 60) * 10) / 10, rate: Math.min(100, percent(used, capacity) ?? 0), parts };
}
