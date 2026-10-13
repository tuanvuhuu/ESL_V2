// Giá trị trạng thái và màu cố định theo DESIGN.md mục 3.3.

import { COLORS } from "./colors";

export type Option<T extends string = string> = { value: T; label: string; color: string };

export const STUDENT_STATUSES = [
  { value: "WAITING", label: "Chờ xếp lớp", color: COLORS.neutral },
  { value: "STUDYING", label: "Đang học", color: COLORS.success },
  { value: "RESERVED", label: "Bảo lưu", color: COLORS.done },
  { value: "PAUSED", label: "Tạm nghỉ", color: COLORS.attention },
  { value: "FINISHED", label: "Đã kết thúc", color: COLORS.accent },
  { value: "QUIT", label: "Đã nghỉ", color: COLORS.danger },
] as const satisfies readonly Option[];

export const CLASS_STATUSES = [
  { value: "PLANNED", label: "Dự kiến", color: COLORS.neutral },
  { value: "ACTIVE", label: "Đang học", color: COLORS.success },
  { value: "SUSPENDED", label: "Tạm dừng", color: COLORS.attention },
  { value: "FINISHED", label: "Đã kết thúc", color: COLORS.accent },
  { value: "CANCELLED", label: "Đã hủy", color: COLORS.danger },
] as const satisfies readonly Option[];

export const SESSION_STATUSES = [
  { value: "SCHEDULED", label: "Theo lịch", color: COLORS.accent },
  { value: "CANCELLED", label: "Đã hủy", color: COLORS.danger },
] as const satisfies readonly Option[];

export const TEACHER_STATUSES = [
  { value: "ACTIVE", label: "Đang làm", color: COLORS.success },
  { value: "PAUSED", label: "Tạm nghỉ", color: COLORS.attention },
  { value: "LEFT", label: "Đã nghỉ việc", color: COLORS.neutral },
] as const satisfies readonly Option[];

export const TEACHER_ROLES = [
  { value: "TEACHER", label: "Giáo viên", color: COLORS.accent },
  { value: "ASSISTANT", label: "Trợ giảng", color: COLORS.done },
  { value: "BOTH", label: "GV & trợ giảng", color: COLORS.teal },
] as const satisfies readonly Option[];

export const TEACHER_ORIGINS = [
  { value: "VN", label: "Việt Nam", color: COLORS.neutral },
  { value: "FOREIGN", label: "Nước ngoài", color: COLORS.neutral },
] as const satisfies readonly Option[];

export const EMPLOYMENTS = [
  { value: "FULL_TIME", label: "Toàn thời gian", color: COLORS.neutral },
  { value: "PART_TIME", label: "Bán thời gian", color: COLORS.neutral },
] as const satisfies readonly Option[];

export const GENDERS = [
  { value: "MALE", label: "Nam", color: COLORS.neutral },
  { value: "FEMALE", label: "Nữ", color: COLORS.neutral },
] as const satisfies readonly Option[];

export const AUDIENCES = [
  { value: "KINDER", label: "Mầm non", color: COLORS.neutral },
  { value: "PRIMARY", label: "Tiểu học", color: COLORS.neutral },
  { value: "SECONDARY", label: "THCS", color: COLORS.neutral },
  { value: "HIGH", label: "THPT", color: COLORS.neutral },
  { value: "ADULT", label: "Người lớn", color: COLORS.neutral },
] as const satisfies readonly Option[];

export const RELATIONS = ["Bố", "Mẹ", "Ông", "Bà", "Anh/Chị", "Người giám hộ"] as const;

export const QUIT_REASONS = [
  "Chuyển nhà",
  "Học phí",
  "Không sắp xếp được lịch",
  "Không hài lòng chất lượng",
  "Chuyển trung tâm khác",
  "Khác",
] as const;

/** Kết quả cuối khóa, giáo viên hoặc giáo vụ ghi khi khóa kết thúc (lịch sử học tập theo khóa). */
export const COURSE_OUTCOMES = [
  { value: "PROMOTED", label: "Đủ điều kiện lên khóa tiếp", color: COLORS.success },
  { value: "COMPLETED", label: "Hoàn thành khóa", color: COLORS.accent },
  { value: "REPEAT", label: "Nên học lại khóa này", color: COLORS.attention },
  { value: "DROPPED", label: "Dừng giữa khóa", color: COLORS.neutral },
] as const satisfies readonly Option[];

/** Kênh liên lạc với phụ huynh. */
export const CONTACT_CHANNELS = [
  { value: "CALL", label: "Gọi điện", color: COLORS.accent },
  { value: "ZALO", label: "Zalo / tin nhắn", color: COLORS.teal },
  { value: "MEET", label: "Gặp trực tiếp", color: COLORS.done },
  { value: "OTHER", label: "Khác", color: COLORS.neutral },
] as const satisfies readonly Option[];

/** Chứng chỉ giáo viên hết hạn trong số ngày này thì cảnh báo (M8). */
export const CERT_WARN_DAYS = 60;

export const WEEKDAYS = [
  { value: 1, short: "T2", label: "Thứ 2" },
  { value: 2, short: "T3", label: "Thứ 3" },
  { value: 3, short: "T4", label: "Thứ 4" },
  { value: 4, short: "T5", label: "Thứ 5" },
  { value: 5, short: "T6", label: "Thứ 6" },
  { value: 6, short: "T7", label: "Thứ 7" },
  { value: 7, short: "CN", label: "Chủ nhật" },
] as const;

export const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];

export function optionOf(opts: readonly Option[], value: string | null | undefined) {
  return opts.find((o) => o.value === value);
}

/** "1,3,5" → "T2-T4-T6" */
export function weekdayText(s: string): string {
  return s
    .split(",")
    .map((d) => WEEKDAYS.find((w) => w.value === Number(d))?.short)
    .filter(Boolean)
    .join("-");
}
