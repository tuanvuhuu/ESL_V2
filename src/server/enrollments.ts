// Xếp lớp và chuyển lớp: kiểm tra chung (lớp còn mở, còn chỗ, không trùng giờ), ghi nhật ký.
import type { Prisma } from "@prisma/client";
import { formatDateVN } from "@/lib/dates";
import { canEditCenter, type Viewer } from "@/lib/permissions";
import { logChange } from "./audit";
import { balancesFor } from "./attendance";
import { assertStudentFree } from "./classes";
import { allow, badRequest, conflict, notFound } from "./http";

type Tx = Prisma.TransactionClient;

/** Kiểm tra lớp nhận được thêm học sinh rồi tạo ghi danh. */
export async function createEnrollment(
  tx: Tx,
  input: {
    classId: number;
    studentId: number;
    joinedAt: string;
    purchasedSessions?: number;
    transferredFromId?: number;
    adjustmentNote?: string | null;
    tuitionFee?: number | null;
    discountType?: string | null;
    discountMode?: string | null;
    discountValue?: number | null;
    dueDate?: string | null;
  },
) {
  const cls = await tx.classGroup.findUnique({ where: { id: input.classId }, include: { room: true, course: true } });
  if (!cls) throw notFound("Không tìm thấy lớp");
  if (cls.status === "CANCELLED" || cls.status === "FINISHED") throw badRequest(`Lớp ${cls.code} đã kết thúc hoặc đã hủy`);
  const already = await tx.classEnrollment.findFirst({ where: { classId: cls.id, studentId: input.studentId, leftAt: null } });
  if (already) throw badRequest("Học sinh đã ở trong lớp này");
  const current = await tx.classEnrollment.count({ where: { classId: cls.id, leftAt: null } });
  const limit = Math.min(cls.maxStudents, cls.room.capacity);
  if (current >= limit) {
    throw conflict(
      `Không thể xếp lớp: lớp ${cls.code} đã đủ ${current}/${limit} học sinh (sĩ số tối đa ${cls.maxStudents}, phòng ${cls.room.name} chứa ${cls.room.capacity}). Chọn lớp khác.`,
    );
  }
  await assertStudentFree(tx, input.studentId, cls.id);
  const tuitionFee = input.tuitionFee !== undefined ? input.tuitionFee : (cls.course?.tuition ?? null);
  const e = await tx.classEnrollment.create({
    data: {
      classId: cls.id,
      studentId: input.studentId,
      joinedAt: input.joinedAt,
      purchasedSessions: input.purchasedSessions ?? cls.totalSessions,
      transferredFromId: input.transferredFromId,
      adjustmentNote: input.adjustmentNote,
      tuitionFee,
      discountType: input.discountType,
      discountMode: input.discountMode,
      discountValue: input.discountValue,
      dueDate: input.dueDate,
    },
  });
  return { enrollment: e, cls };
}

/**
 * Chuyển lớp (có thể sang trung tâm khác): đóng ghi danh cũ từ ngày `date`, mở ghi danh ở lớp mới
 * với số buổi đã mua = số buổi còn lại của ghi danh cũ. Ghi danh cũ được trừ đúng số buổi đó
 * (điều chỉnh tay kèm lý do) để số buổi không bị tính hai lần.
 */
export async function transferEnrollment(
  tx: Tx,
  viewer: Viewer,
  input: { enrollmentId: number; toClassId: number; date: string; note: string | null; moveCenter: boolean },
) {
  const from = await tx.classEnrollment.findUnique({
    where: { id: input.enrollmentId },
    include: { class: true, student: true },
  });
  if (!from) throw notFound("Không tìm thấy ghi danh");
  if (from.leftAt) throw badRequest("Học sinh đã rời lớp này");
  if (from.classId === input.toClassId) throw badRequest("Chọn một lớp khác lớp đang học");
  if (input.date < from.joinedAt) throw badRequest(`Ngày chuyển phải từ ngày vào lớp (${formatDateVN(from.joinedAt)}) trở đi`);
  const to = await tx.classGroup.findUnique({ where: { id: input.toClassId } });
  if (!to) throw notFound("Không tìm thấy lớp mới");
  allow(canEditCenter(viewer, from.class.centerId), "Chỉ chuyển được học sinh trong lớp của trung tâm mình");
  allow(canEditCenter(viewer, to.centerId), "Lớp mới thuộc trung tâm khác: nhờ giáo vụ trung tâm đó hoặc quản lý chuyển");

  // Đã điểm danh ở lớp cũ từ ngày chuyển trở đi thì không chuyển được, tránh mất dữ liệu.
  const after = await tx.attendance.findFirst({
    where: { enrollmentId: from.id, makeupId: null, session: { classId: from.classId, date: { gte: input.date } } },
    include: { session: true },
  });
  if (after) {
    throw conflict(
      `Không thể chuyển từ ${formatDateVN(input.date)}: ${from.student.fullName} đã được điểm danh ở lớp ${from.class.code} ngày ${formatDateVN(after.session.date)}. Chọn ngày chuyển sau ngày đó.`,
    );
  }

  const balance = (await balancesFor(tx, [from.id])).get(from.id)!;
  const carried = Math.max(0, balance.remaining);
  await tx.classEnrollment.update({
    where: { id: from.id },
    data: {
      leftAt: input.date,
      adjustment: from.adjustment - carried,
      adjustmentNote: [from.adjustmentNote, `Chuyển ${carried} buổi sang lớp ${to.code}`].filter(Boolean).join("; "),
    },
  });
  const { enrollment } = await createEnrollment(tx, {
    classId: to.id,
    studentId: from.studentId,
    joinedAt: input.date,
    purchasedSessions: carried,
    transferredFromId: from.id,
  });

  if (input.moveCenter && to.centerId !== from.student.centerId) {
    await tx.student.update({ where: { id: from.studentId }, data: { centerId: to.centerId } });
    await logChange(tx, "Student", from.studentId, "update", { centerId: [from.student.centerId, to.centerId] });
  }
  if (from.student.status === "WAITING" || from.student.status === "FINISHED") {
    await tx.student.update({ where: { id: from.studentId }, data: { status: "STUDYING" } });
  }
  const extra = input.note ? { note: [null, input.note] } : {};
  await logChange(tx, "Student", from.studentId, "transfer", { class: [from.class.code, to.code], carriedSessions: [null, carried], date: [null, input.date], ...extra });
  await logChange(tx, "Class", from.classId, "leave", { student: [from.student.fullName, null], transferTo: [null, to.code] });
  await logChange(tx, "Class", to.id, "enroll", { student: [null, from.student.fullName], transferFrom: [null, from.class.code] });
  return { enrollment, carried };
}
