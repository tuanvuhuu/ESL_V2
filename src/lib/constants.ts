// Giá trị trạng thái và màu cố định theo DESIGN.md mục 3.3.

export type Option<T extends string = string> = { value: T; label: string; color: string };

export const STUDENT_STATUSES = [
  { value: "WAITING", label: "Chờ xếp lớp", color: "#8C959F" },
  { value: "STUDYING", label: "Đang học", color: "#2DA44E" },
  { value: "RESERVED", label: "Bảo lưu", color: "#8250DF" },
  { value: "PAUSED", label: "Tạm nghỉ", color: "#D29922" },
  { value: "FINISHED", label: "Đã kết thúc", color: "#1F6FEB" },
  { value: "QUIT", label: "Đã nghỉ", color: "#CF222E" },
] as const satisfies readonly Option[];

export const CLASS_STATUSES = [
  { value: "PLANNED", label: "Dự kiến", color: "#8C959F" },
  { value: "ACTIVE", label: "Đang học", color: "#2DA44E" },
  { value: "SUSPENDED", label: "Tạm dừng", color: "#D29922" },
  { value: "FINISHED", label: "Đã kết thúc", color: "#1F6FEB" },
  { value: "CANCELLED", label: "Đã hủy", color: "#CF222E" },
] as const satisfies readonly Option[];

export const SESSION_STATUSES = [
  { value: "SCHEDULED", label: "Theo lịch", color: "#1F6FEB" },
  { value: "CANCELLED", label: "Đã hủy", color: "#CF222E" },
] as const satisfies readonly Option[];

export const TEACHER_STATUSES = [
  { value: "ACTIVE", label: "Đang làm", color: "#2DA44E" },
  { value: "PAUSED", label: "Tạm nghỉ", color: "#D29922" },
  { value: "LEFT", label: "Đã nghỉ việc", color: "#8C959F" },
] as const satisfies readonly Option[];

export const TEACHER_ROLES = [
  { value: "TEACHER", label: "Giáo viên", color: "#1F6FEB" },
  { value: "ASSISTANT", label: "Trợ giảng", color: "#8250DF" },
  { value: "BOTH", label: "GV & trợ giảng", color: "#0E7490" },
] as const satisfies readonly Option[];

export const TEACHER_ORIGINS = [
  { value: "VN", label: "Việt Nam", color: "#59636E" },
  { value: "FOREIGN", label: "Nước ngoài", color: "#59636E" },
] as const satisfies readonly Option[];

export const EMPLOYMENTS = [
  { value: "FULL_TIME", label: "Toàn thời gian", color: "#59636E" },
  { value: "PART_TIME", label: "Bán thời gian", color: "#59636E" },
] as const satisfies readonly Option[];

export const GENDERS = [
  { value: "MALE", label: "Nam", color: "#59636E" },
  { value: "FEMALE", label: "Nữ", color: "#59636E" },
] as const satisfies readonly Option[];

export const AUDIENCES = [
  { value: "KINDER", label: "Mầm non", color: "#59636E" },
  { value: "PRIMARY", label: "Tiểu học", color: "#59636E" },
  { value: "SECONDARY", label: "THCS", color: "#59636E" },
  { value: "HIGH", label: "THPT", color: "#59636E" },
  { value: "ADULT", label: "Người lớn", color: "#59636E" },
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
