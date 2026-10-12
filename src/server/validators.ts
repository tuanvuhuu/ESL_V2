import { z } from "zod";
import {
  AUDIENCES,
  CLASS_STATUSES,
  EMPLOYMENTS,
  GENDERS,
  STUDENT_STATUSES,
  TEACHER_ORIGINS,
  TEACHER_ROLES,
  TEACHER_STATUSES,
  values,
} from "@/lib/constants";
import { ATTENDANCE_STATUSES } from "@/lib/attendance";
import { isValidISODate, isValidTime, todayISO } from "@/lib/dates";
import { isValidPhone, normalizePhone } from "@/lib/text";

const optText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
const reqText = (msg: string) => z.string({ error: msg }).trim().min(1, msg).max(200);
const isoDate = (msg = "Ngày không hợp lệ") => z.string().refine(isValidISODate, msg);
const time = z.string().refine(isValidTime, "Giờ không hợp lệ (HH:mm)");
const phone = z
  .string({ error: "Nhập số điện thoại" })
  .refine(isValidPhone, "SĐT gồm 10 số, bắt đầu bằng 0")
  .transform(normalizePhone);
const optPhone = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || isValidPhone(v), "SĐT gồm 10 số, bắt đầu bằng 0")
  .transform((v) => (v ? normalizePhone(v) : null));

export const parentSchema = z.object({
  fullName: reqText("Nhập họ tên phụ huynh"),
  phone,
  zalo: optText,
  email: optText,
  note: optText,
});

export const studentSchema = z
  .object({
    fullName: reqText("Nhập họ và tên"),
    englishName: optText,
    dob: isoDate("Ngày sinh không hợp lệ").refine((d) => d <= todayISO(), "Ngày sinh không được ở tương lai"),
    gender: z.enum(values(GENDERS), { message: "Chọn giới tính" }),
    audience: z.enum(values(AUDIENCES), { message: "Chọn nhóm đối tượng" }),
    school: optText,
    schoolGrade: optText,
    centerId: z.number({ error: "Chọn trung tâm" }).int().positive(),
    level: optText,
    status: z.enum(values(STUDENT_STATUSES)).default("WAITING"),
    statusReason: optText,
    note: optText,
  })
  .refine((s) => s.status !== "QUIT" || !!s.statusReason, {
    message: "Chọn lý do nghỉ",
    path: ["statusReason"],
  });

export const guardianInput = z.object({
  parentId: z.number().int().positive().optional(),
  fullName: reqText("Nhập họ tên phụ huynh"),
  phone,
  relation: reqText("Chọn quan hệ"),
  zalo: optText,
  note: optText,
});

export const studentCreateSchema = z.object({
  student: studentSchema,
  parent: guardianInput,
});

export const statusChangeSchema = z
  .object({
    status: z.enum(values(STUDENT_STATUSES)),
    reason: optText,
    note: optText,
  })
  .refine((s) => s.status !== "QUIT" || !!s.reason, { message: "Chọn lý do nghỉ", path: ["reason"] });

export const guardianLinkSchema = z.object({
  parentId: z.number().int().positive(),
  relation: reqText("Chọn quan hệ"),
  isPrimary: z.boolean().default(false),
  isPayer: z.boolean().default(false),
});

export const teacherSchema = z.object({
  fullName: reqText("Nhập họ và tên"),
  displayName: reqText("Nhập tên hiển thị"),
  phone: optPhone,
  email: optText,
  role: z.enum(values(TEACHER_ROLES)),
  origin: z.enum(values(TEACHER_ORIGINS)),
  employment: z.enum(values(EMPLOYMENTS)),
  status: z.enum(values(TEACHER_STATUSES)).default("ACTIVE"),
  qualifications: optText,
  startDate: isoDate().optional().nullable(),
  note: optText,
  centerIds: z.array(z.number().int().positive()).min(1, "Chọn ít nhất một trung tâm"),
});

export const classSchema = z
  .object({
    name: reqText("Nhập tên lớp"),
    courseId: z.number().int().positive().optional().nullable(),
    centerId: z.number({ error: "Chọn trung tâm" }).int().positive(),
    roomId: z.number({ error: "Chọn phòng" }).int().positive(),
    teacherId: z.number({ error: "Chọn giáo viên" }).int().positive(),
    assistantIds: z.array(z.number().int().positive()).max(2, "Mỗi lớp tối đa 2 trợ giảng").default([]),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Chọn ít nhất một thứ trong tuần"),
    startTime: time,
    endTime: time,
    startDate: isoDate("Chọn ngày khai giảng"),
    totalSessions: z.number().int().min(1, "Số buổi phải lớn hơn 0").max(300),
    maxStudents: z.number().int().min(1).max(100).default(12),
    note: optText,
  })
  .refine((c) => c.startTime < c.endTime, { message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"] });

export const classUpdateSchema = z.object({
  name: reqText("Nhập tên lớp").optional(),
  status: z.enum(values(CLASS_STATUSES)).optional(),
  maxStudents: z.number().int().min(1).max(100).optional(),
  note: optText,
  assistantIds: z.array(z.number().int().positive()).max(2, "Mỗi lớp tối đa 2 trợ giảng").optional(),
});

export const sessionUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    reason: reqText("Nhập lý do hủy"),
    appendAtEnd: z.boolean().default(false),
  }),
  z.object({ action: z.literal("restore") }),
  z
    .object({
      action: z.literal("change"),
      date: isoDate().optional(),
      startTime: time.optional(),
      endTime: time.optional(),
      roomId: z.number().int().positive().optional(),
      teacherId: z.number().int().positive().optional(),
      note: optText,
    })
    .refine((s) => !s.startTime || !s.endTime || s.startTime < s.endTime, {
      message: "Giờ kết thúc phải sau giờ bắt đầu",
      path: ["endTime"],
    }),
]);

export const enrollSchema = z.object({
  studentId: z.number().int().positive(),
  joinedAt: isoDate().optional(),
  purchasedSessions: z.number().int().min(0, "Số buổi không hợp lệ").max(500).optional(),
});

/** Sửa số buổi đã mua và điều chỉnh tay; điều chỉnh khác 0 thì bắt buộc ghi lý do. */
export const enrollmentUpdateSchema = z
  .object({
    purchasedSessions: z.number({ error: "Nhập số buổi đã mua" }).int().min(0, "Số buổi không hợp lệ").max(500),
    adjustment: z.number().int().min(-500).max(500).default(0),
    adjustmentNote: optText,
  })
  .refine((e) => e.adjustment === 0 || !!e.adjustmentNote, { message: "Ghi lý do điều chỉnh", path: ["adjustmentNote"] });

export const attendanceSchema = z.object({
  lessonContent: z
    .string()
    .trim()
    .max(300, "Nội dung đã dạy tối đa 300 ký tự")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  items: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: z.enum(values(ATTENDANCE_STATUSES)),
        comment: z
          .string()
          .trim()
          .max(200, "Nhận xét tối đa 200 ký tự")
          .optional()
          .nullable()
          .transform((v) => (v ? v : null)),
      }),
    )
    .max(200),
});

export const makeupSchema = z.object({
  absenceId: z.number().int().positive(),
  sessionId: z.number({ error: "Chọn buổi học bù" }).int().positive(),
});

export const centerSchema = z.object({
  name: reqText("Nhập tên trung tâm"),
  address: optText,
  openHours: optText,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Màu dạng #RRGGBB"),
});

export const roomSchema = z.object({
  centerId: z.number().int().positive(),
  name: reqText("Nhập tên phòng"),
  capacity: z.number().int().min(1).max(200),
  equipment: optText,
  active: z.boolean().default(true),
});

export const holidaySchema = z.object({
  date: isoDate("Chọn ngày"),
  name: reqText("Nhập tên ngày nghỉ"),
  centerId: z.number().int().positive().optional().nullable(),
});

export const courseSchema = z.object({
  name: reqText("Nhập tên khóa"),
  program: optText,
  level: optText,
  totalSessions: z.number().int().min(1).max(300),
  sessionMinutes: z.number().int().min(15).max(480),
  tuition: z.number().int().min(0),
  maxStudents: z.number().int().min(1).max(100),
});

const ROLE_VALUES = ["MANAGER", "OFFICE", "TEACHER", "ASSISTANT"] as const;
const username = z
  .string({ error: "Nhập tên đăng nhập" })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Tên đăng nhập 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch");
export const password = z.string({ error: "Nhập mật khẩu" }).min(8, "Mật khẩu tối thiểu 8 ký tự").max(100);

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Nhập tên đăng nhập"),
  password: z.string().min(1, "Nhập mật khẩu"),
});

export const changePasswordSchema = z.object({ current: z.string().min(1, "Nhập mật khẩu hiện tại"), next: password });

export const setupSchema = z.object({ username, fullName: reqText("Nhập họ tên"), password });

/** Giáo vụ phải gắn 1 trung tâm; giáo viên, trợ giảng phải gắn hồ sơ giáo viên. */
const userFields = {
  fullName: reqText("Nhập họ tên"),
  role: z.enum(ROLE_VALUES, { error: "Chọn vai trò" }),
  centerId: z.number().int().positive().optional().nullable(),
  teacherId: z.number().int().positive().optional().nullable(),
  active: z.boolean().default(true),
};
const userRefs = <T extends { role: string; centerId?: number | null; teacherId?: number | null }>(u: T, ctx: z.RefinementCtx) => {
  if (u.role === "OFFICE" && !u.centerId) ctx.addIssue({ code: "custom", path: ["centerId"], message: "Giáo vụ phải chọn trung tâm" });
  if ((u.role === "TEACHER" || u.role === "ASSISTANT") && !u.teacherId)
    ctx.addIssue({ code: "custom", path: ["teacherId"], message: "Chọn hồ sơ giáo viên / trợ giảng của tài khoản" });
};
const normalizeRefs = <T extends { role: string; centerId?: number | null; teacherId?: number | null }>(u: T) => ({
  ...u,
  centerId: u.role === "OFFICE" ? (u.centerId ?? null) : null,
  teacherId: u.role === "TEACHER" || u.role === "ASSISTANT" ? (u.teacherId ?? null) : null,
});

export const userCreateSchema = z.object({ ...userFields, username, password }).superRefine(userRefs).transform(normalizeRefs);
export const userUpdateSchema = z
  .object({ ...userFields, password: password.optional().nullable().or(z.literal("")) })
  .superRefine(userRefs)
  .transform(normalizeRefs);
