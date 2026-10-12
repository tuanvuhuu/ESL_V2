// Phân quyền theo 4 vai trò (Tổng quan yêu cầu mục 2, DESIGN.md mục 7).
// Dùng chung cho server (chặn API) và giao diện (ẩn hẳn mục không có quyền).
// Các mục "chờ chốt" đang theo mặc định của đặc tả đợt 1:
// - Giáo vụ xem được dữ liệu trung tâm khác nhưng chỉ sửa trung tâm mình.
// - Giáo viên, trợ giảng chỉ xem lớp mình, không thấy SĐT / Zalo / email phụ huynh.
// - Trợ giảng được điểm danh (dùng khi có màn hình điểm danh).

export const USER_ROLES = [
  { value: "MANAGER", label: "Quản lý", color: "#CF222E" },
  { value: "OFFICE", label: "Giáo vụ", color: "#1F6FEB" },
  { value: "TEACHER", label: "Giáo viên", color: "#2DA44E" },
  { value: "ASSISTANT", label: "Trợ giảng", color: "#8250DF" },
] as const;

export type Role = (typeof USER_ROLES)[number]["value"];

export type Viewer = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  /** Trung tâm của giáo vụ. */
  centerId: number | null;
  /** Hồ sơ giáo viên / trợ giảng gắn với tài khoản. */
  teacherId: number | null;
};

export const isManager = (v: Viewer) => v.role === "MANAGER";
export const isOffice = (v: Viewer) => v.role === "OFFICE";
/** Giáo viên hoặc trợ giảng: chỉ thấy lớp mình. */
export const isStaff = (v: Viewer) => v.role === "TEACHER" || v.role === "ASSISTANT";

/** Chọn "Tất cả trung tâm". */
export const canSeeAllCenters = (v: Viewer) => isManager(v);

/** Sửa dữ liệu thuộc một trung tâm: học sinh, lớp, buổi học, xếp lớp. */
export const canEditCenter = (v: Viewer, centerId: number | null | undefined) =>
  isManager(v) || (isOffice(v) && centerId != null && v.centerId === centerId);

/** Thêm mới học sinh, phụ huynh, lớp (trung tâm kiểm tra riêng khi lưu). */
export const canCreateRecords = (v: Viewer) => isManager(v) || isOffice(v);

/** Danh sách và hồ sơ phụ huynh, SĐT / Zalo / email phụ huynh. */
export const canSeeParents = (v: Viewer) => isManager(v) || isOffice(v);

/** Danh sách giáo viên và hồ sơ của người khác. */
export const canSeeTeachers = (v: Viewer) => isManager(v) || isOffice(v);

/** Thêm, sửa hồ sơ giáo viên / trợ giảng. */
export const canEditTeachers = (v: Viewer) => isManager(v);

/**
 * Sửa lịch rảnh, đăng ký ngày nghỉ của một giáo viên / trợ giảng (DESIGN mục 7, đang theo mặc định):
 * quản lý mọi người; giáo vụ người dạy ở trung tâm mình; giáo viên, trợ giảng của chính mình.
 */
export const canManageTeacherTime = (v: Viewer, teacherId: number, teacherCenterIds: number[]) =>
  isManager(v) || (isOffice(v) && v.centerId != null && teacherCenterIds.includes(v.centerId)) || (v.teacherId != null && v.teacherId === teacherId);

/** Trung tâm, phòng, ngày nghỉ, khóa học, tài khoản. */
export const canManageSettings = (v: Viewer) => isManager(v);

/** Lịch sử thay đổi. */
export const canSeeAudit = (v: Viewer) => isManager(v) || isOffice(v);

/** Điểm danh (người dạy, trợ giảng của buổi; giáo vụ trung tâm của lớp). Kiểm tra theo buổi ở src/server/attendance.ts. */
export const canTakeAttendance = (v: Viewer) => isManager(v) || isOffice(v) || isStaff(v);

/** Xếp học bù, xem danh sách cần chú ý. */
export const canArrangeMakeups = (v: Viewer) => isManager(v) || isOffice(v);

/**
 * Ghi kết quả cuối khóa và nhận xét tổng kết: giáo viên chính của lớp, giáo vụ trung tâm của lớp, quản lý.
 * `classTeacherId`: giáo viên chính của lớp.
 */
export const canWriteOutcome = (v: Viewer, classCenterId: number, classTeacherId: number) =>
  canEditCenter(v, classCenterId) || (v.teacherId != null && v.teacherId === classTeacherId);

/** Nhật ký liên lạc, việc cần gọi lại: xem như phụ huynh; ghi thì theo trung tâm của học sinh (canEditCenter). */
export const canSeeContacts = (v: Viewer) => canSeeParents(v);

/** Trang đầu tiên sau khi đăng nhập và các mục menu được thấy. */
export function canOpenPage(v: Viewer, path: string): boolean {
  if (path.startsWith("/settings")) return canManageSettings(v);
  if (path.startsWith("/my")) return isStaff(v) && v.teacherId != null;
  if (path.startsWith("/makeups")) return canArrangeMakeups(v);
  if (path.startsWith("/parents")) return canSeeParents(v);
  if (path.startsWith("/followups")) return canSeeContacts(v);
  if (path.startsWith("/teachers/")) return canSeeTeachers(v) || Number(path.split("/")[2]) === v.teacherId;
  if (path.startsWith("/teachers")) return canSeeTeachers(v);
  return true;
}

export const roleLabel = (role: string) => USER_ROLES.find((r) => r.value === role)?.label ?? role;
