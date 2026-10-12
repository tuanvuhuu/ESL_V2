// Kiểu dữ liệu phía giao diện (rút gọn từ kết quả API).

export type Room = { id: number; centerId: number; name: string; capacity: number; equipment: string | null; active: boolean };
export type Center = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  openHours: string | null;
  color: string;
  rooms: Room[];
};
export type CenterLite = { id: number; name: string; color: string };

export type Parent = {
  id: number;
  fullName: string;
  phone: string;
  zalo: string | null;
  email: string | null;
  note: string | null;
};

export type Guardian = { id: number; parentId: number; relation: string; isPrimary: boolean; isPayer: boolean; parent: Parent };

export type Student = {
  id: number;
  code: string;
  fullName: string;
  englishName: string | null;
  dob: string;
  gender: string;
  audience: string;
  school: string | null;
  schoolGrade: string | null;
  centerId: number;
  level: string | null;
  status: string;
  statusReason: string | null;
  note: string | null;
  createdAt: string;
};

export type StudentRow = Student & {
  center: CenterLite;
  guardians: Guardian[];
  enrollments: { id: number; class: { id: number; code: string; name: string } }[];
};

export type Teacher = {
  id: number;
  code: string;
  fullName: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  role: string;
  origin: string;
  employment: string;
  status: string;
  qualifications: string | null;
  certExpiry: string | null;
  startDate: string | null;
  note: string | null;
  centers: { centerId: number; center: CenterLite }[];
};

export type Course = {
  id: number;
  name: string;
  program: string | null;
  level: string | null;
  totalSessions: number;
  sessionMinutes: number;
  tuition: number;
  maxStudents: number;
};

export type SessionRow = {
  id: number;
  classId: number;
  index: number;
  date: string;
  startTime: string;
  endTime: string;
  roomId: number;
  teacherId: number;
  status: string;
  note: string | null;
  lessonContent?: string | null;
  attendanceTakenAt?: string | null;
  attendanceBy?: string | null;
  room: { id?: number; name: string };
  teacher: { id: number; displayName: string };
  _count?: { attendances: number; makeups: number };
};

export type { Balance } from "@/lib/attendance";

export type ScheduleSession = SessionRow & {
  class: {
    id: number;
    code: string;
    name: string;
    teacherId: number;
    center: CenterLite;
    assistants: { teacher: { id: number; displayName: string } }[];
    _count: { enrollments: number };
  };
};

export type AuditRow = {
  id: number;
  entity: string;
  entityId: number;
  action: string;
  changes: Record<string, [unknown, unknown]>;
  actor: string;
  createdAt: string;
};
