// Phạm vi dữ liệu theo người đăng nhập. Quy tắc quyền nằm ở src/lib/permissions.ts,
// file này chỉ tra DB để biết bản ghi thuộc trung tâm nào / lớp nào.
import type { Prisma } from "@prisma/client";
import { canEditCenter, canSeeParents, isManager, isOffice, isStaff, type Viewer } from "@/lib/permissions";
import { prisma } from "./db";
import { allow, notFound } from "./http";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Lớp mà giáo viên / trợ giảng đang dạy chính, trợ giảng hoặc dạy thay ít nhất một buổi. */
export function staffClassWhere(v: Viewer): Prisma.ClassGroupWhereInput {
  const teacherId = v.teacherId ?? -1;
  return {
    OR: [{ teacherId }, { assistants: { some: { teacherId } } }, { sessions: { some: { teacherId } } }],
  };
}

/** Học sinh đang học một lớp của giáo viên / trợ giảng. */
export function staffStudentWhere(v: Viewer): Prisma.StudentWhereInput {
  return { enrollments: { some: { leftAt: null, class: staffClassWhere(v) } } };
}

/** Giáo viên, trợ giảng chỉ mở được lớp mình; người khác mở được mọi lớp. */
export async function assertCanViewClass(v: Viewer, classId: number) {
  if (!isStaff(v)) return;
  const ok = await prisma.classGroup.count({ where: { id: classId, ...staffClassWhere(v) } });
  if (!ok) throw notFound("Không tìm thấy lớp");
}

export async function assertCanViewStudent(v: Viewer, studentId: number) {
  if (!isStaff(v)) return;
  const ok = await prisma.student.count({ where: { id: studentId, ...staffStudentWhere(v) } });
  if (!ok) throw notFound("Không tìm thấy học sinh");
}

export async function assertCanEditClass(tx: Tx, v: Viewer, classId: number) {
  const c = await tx.classGroup.findUnique({ where: { id: classId }, select: { centerId: true } });
  if (!c) throw notFound("Không tìm thấy lớp");
  allow(canEditCenter(v, c.centerId), "Chỉ sửa được lớp của trung tâm mình");
}

export async function assertCanEditStudent(tx: Tx, v: Viewer, studentId: number) {
  const s = await tx.student.findUnique({ where: { id: studentId }, select: { centerId: true } });
  if (!s) throw notFound("Không tìm thấy học sinh");
  allow(canEditCenter(v, s.centerId), "Chỉ sửa được học sinh của trung tâm mình");
}

/** Giáo vụ sửa được phụ huynh có con ở trung tâm mình, hoặc chưa gắn với học sinh nào. */
export async function assertCanEditParent(tx: Tx, v: Viewer, parentId: number) {
  if (isManager(v)) return;
  allow(isOffice(v));
  const children = await tx.studentGuardian.findMany({ where: { parentId }, select: { student: { select: { centerId: true } } } });
  allow(
    children.length === 0 || children.some((c) => c.student.centerId === v.centerId),
    "Chỉ sửa được phụ huynh có con học ở trung tâm mình",
  );
}

/** Ẩn SĐT, Zalo, email, ghi chú phụ huynh với người không được xem. */
export function redactParent<P extends { phone: string; zalo?: string | null; email?: string | null; note?: string | null }>(
  v: Viewer,
  p: P,
): P {
  if (canSeeParents(v)) return p;
  return { ...p, phone: "", zalo: null, email: null, note: null };
}
