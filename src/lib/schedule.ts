// Sinh lịch buổi học và kiểm tra trùng lịch (yêu cầu 3.5, quy tắc mục 5).
import { addDays, formatDateVN, isoWeekday, toMinutes } from "./dates";

export type HolidayLite = { date: string; centerId: number | null; name?: string };

export type GenerateInput = {
  startDate: string;
  weekdays: number[];
  totalSessions: number;
  centerId: number;
  holidays: HolidayLite[];
};

/** Danh sách ngày học từ ngày khai giảng, theo các thứ lặp, bỏ qua ngày lễ chung và ngày lễ của trung tâm. */
export function generateSessionDates({ startDate, weekdays, totalSessions, centerId, holidays }: GenerateInput): {
  dates: string[];
  skipped: { date: string; name?: string }[];
} {
  const wd = new Set(weekdays);
  if (wd.size === 0 || totalSessions <= 0) return { dates: [], skipped: [] };
  const off = new Map<string, string | undefined>();
  for (const h of holidays) if (h.centerId === null || h.centerId === centerId) off.set(h.date, h.name);

  const dates: string[] = [];
  const skipped: { date: string; name?: string }[] = [];
  let d = startDate;
  // Giới hạn an toàn: tối đa 5 năm.
  for (let i = 0; i < 366 * 5 && dates.length < totalSessions; i++, d = addDays(d, 1)) {
    if (!wd.has(isoWeekday(d))) continue;
    if (off.has(d)) {
      skipped.push({ date: d, name: off.get(d) });
      continue;
    }
    dates.push(d);
  }
  return { dates, skipped };
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

/** Một buổi dự kiến hoặc đã có, với những người đứng lớp (giáo viên + trợ giảng). */
export type SlotLite = {
  sessionId?: number;
  classId?: number;
  classCode?: string;
  date: string;
  startTime: string;
  endTime: string;
  roomId: number;
  roomName?: string;
  centerId: number;
  centerName?: string;
  staffIds: number[];
};

export type Conflict = {
  kind: "ROOM" | "STAFF";
  date: string;
  staffId?: number;
  with: SlotLite;
  message: string;
};

/**
 * Chặn: trùng phòng; một người dạy hai buổi trùng giờ ở hai trung tâm khác nhau.
 * Cho phép: một người đứng nhiều lớp trùng giờ trong cùng trung tâm.
 */
export function findConflicts(
  candidates: SlotLite[],
  existing: SlotLite[],
  staffNames: Record<number, string> = {},
): Conflict[] {
  const byDate = new Map<string, SlotLite[]>();
  for (const e of existing) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const out: Conflict[] = [];
  for (const c of candidates) {
    for (const e of byDate.get(c.date) ?? []) {
      if (c.sessionId !== undefined && c.sessionId === e.sessionId) continue;
      if (!overlaps(c.startTime, c.endTime, e.startTime, e.endTime)) continue;
      const when = `${e.startTime}–${e.endTime} ${formatDateVN(e.date, true)}`;
      if (c.roomId === e.roomId) {
        out.push({
          kind: "ROOM",
          date: c.date,
          with: e,
          message: `Phòng ${e.roomName ?? c.roomName ?? ""} đã có lớp ${e.classCode ?? ""} lúc ${when}. Chọn phòng khác hoặc giờ khác.`,
        });
      }
      if (c.centerId !== e.centerId) {
        for (const sid of c.staffIds) {
          if (!e.staffIds.includes(sid)) continue;
          out.push({
            kind: "STAFF",
            date: c.date,
            staffId: sid,
            with: e,
            message: `${staffNames[sid] ?? "Người dạy"} đang dạy lớp ${e.classCode ?? ""} ở ${e.centerName ?? "trung tâm khác"} lúc ${when}. Chọn người khác hoặc giờ khác.`,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Trạng thái lớp tự đổi theo lịch (L8): "Dự kiến" thành "Đang học" từ ngày có buổi đầu tiên,
 * "Dự kiến" / "Đang học" thành "Đã kết thúc" từ ngày sau buổi cuối. Tạm dừng, đã hủy giữ nguyên.
 * `first`, `last`: ngày buổi đầu, buổi cuối chưa hủy; trống nếu không còn buổi nào.
 */
export function autoClassStatus(status: string, first: string | null, last: string | null, today: string): string {
  if (status !== "PLANNED" && status !== "ACTIVE") return status;
  if (!first || !last) return status;
  if (last < today) return "FINISHED";
  if (status === "PLANNED" && first <= today) return "ACTIVE";
  return status;
}

/**
 * Cảnh báo (không chặn): một người dạy hai trung tâm khác nhau cùng ngày mà hai buổi cách nhau chưa tới `gapMinutes` phút
 * (không tính buổi trùng giờ, vì trùng giờ đã bị chặn ở `findConflicts`). Mỗi người, mỗi ngày, mỗi cặp buổi chỉ báo một lần.
 */
export function findTightGaps(
  candidates: SlotLite[],
  existing: SlotLite[],
  staffNames: Record<number, string> = {},
  gapMinutes = 60,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    for (const e of existing) {
      if (e.date !== c.date || e.centerId === c.centerId) continue;
      if (c.sessionId !== undefined && c.sessionId === e.sessionId) continue;
      if (overlaps(c.startTime, c.endTime, e.startTime, e.endTime)) continue;
      const gap = toMinutes(c.startTime) >= toMinutes(e.endTime) ? toMinutes(c.startTime) - toMinutes(e.endTime) : toMinutes(e.startTime) - toMinutes(c.endTime);
      if (gap >= gapMinutes) continue;
      for (const sid of c.staffIds) {
        if (!e.staffIds.includes(sid)) continue;
        const key = `${sid}:${c.date}:${e.sessionId ?? e.classCode}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(
          `${staffNames[sid] ?? "Người dạy"} dạy ${e.classCode ?? "lớp khác"} ở ${e.centerName ?? "trung tâm khác"} lúc ${e.startTime}–${e.endTime} ${formatDateVN(e.date, true)}, chỉ cách ${gap} phút trước/sau buổi này, có thể không kịp di chuyển.`,
        );
      }
    }
  }
  return out;
}
