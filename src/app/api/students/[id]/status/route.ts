import { formatDateVN, todayISO } from "@/lib/dates";
import { assertCanEditStudent } from "@/server/access";
import { logChange } from "@/server/audit";
import { currentActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { badRequest, body, idParam, notFound, route, type IdCtx } from "@/server/http";
import { statusChangeSchema } from "@/server/validators";

/**
 * Đổi trạng thái học sinh. Bảo lưu tạo một lượt bảo lưu (ngày bắt đầu, dự kiến quay lại);
 * rời trạng thái bảo lưu thì đóng lượt đó. Trong thời gian bảo lưu học sinh không có trong
 * danh sách điểm danh nên số buổi còn lại giữ nguyên.
 */
export const POST = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const { status, reason, note, startDate, expectedReturn, returnDate } = await body(req, statusChangeSchema);
  return prisma.$transaction(async (tx) => {
    await assertCanEditStudent(tx, viewer, id);
    const before = await tx.student.findUnique({ where: { id } });
    if (!before) throw notFound("Không tìm thấy học sinh");
    const open = await tx.reservation.findFirst({ where: { studentId: id, returnedAt: null }, orderBy: { id: "desc" } });

    let statusReason: string | null = status === "QUIT" ? reason : null;
    if (status === "RESERVED") {
      if (open) throw badRequest(`${before.fullName} đang bảo lưu đến ${formatDateVN(open.expectedReturn)}`);
      const start = startDate ?? todayISO();
      const r = await tx.reservation.create({
        data: { studentId: id, startDate: start, expectedReturn: expectedReturn!, reason, createdBy: currentActor() },
      });
      statusReason = `đến ${formatDateVN(r.expectedReturn)}`;
      await logChange(tx, "Student", id, "reserve", {
        startDate: [null, start],
        expectedReturn: [null, r.expectedReturn],
        ...(reason ? { reason: [null, reason] } : {}),
      });
    } else if (open) {
      const back = returnDate ?? todayISO();
      const returnedAt = back < open.startDate ? open.startDate : back;
      await tx.reservation.update({ where: { id: open.id }, data: { returnedAt } });
      await logChange(tx, "Student", id, "reserve-end", { startDate: [open.startDate, open.startDate], returnedAt: [null, returnedAt] });
    }

    const after = await tx.student.update({ where: { id }, data: { status, statusReason } });
    await logChange(tx, "Student", id, "status", {
      status: [before.status, status],
      ...(reason ? { reason: [null, reason] } : {}),
      ...(note ? { note: [null, note] } : {}),
    });
    return after;
  });
});
