import { canEditCenter } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { nextSessionDate } from "@/server/classes";
import { prisma } from "@/server/db";
import { allow, badRequest, body, idParam, notFound, route, type IdCtx } from "@/server/http";
import { assertNoConflicts, toSlot } from "@/server/slots";
import { sessionUpdateSchema } from "@/server/validators";

const include = { room: true, class: { include: { center: true, assistants: true } } } as const;

/** Thao tác trên một buổi: hủy (có thể nối buổi vào cuối lịch), khôi phục, dời / đổi phòng / dạy thay. */
export const PATCH = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const input = await body(req, sessionUpdateSchema);
  return prisma.$transaction(async (tx) => {
    const s = await tx.classSession.findUnique({ where: { id }, include });
    if (!s) throw notFound("Không tìm thấy buổi học");
    allow(canEditCenter(viewer, s.class.centerId), "Chỉ sửa được buổi học của trung tâm mình");

    if (input.action === "cancel") {
      if (s.status === "CANCELLED") throw badRequest("Buổi này đã hủy");
      await tx.classSession.update({ where: { id }, data: { status: "CANCELLED", note: input.reason } });
      let appended = null;
      if (input.appendAtEnd) {
        const last = await tx.classSession.findFirst({
          where: { classId: s.classId },
          orderBy: [{ date: "desc" }, { index: "desc" }],
        });
        const maxIndex = await tx.classSession.aggregate({ where: { classId: s.classId }, _max: { index: true } });
        const date = await nextSessionDate(tx, s.class, last?.date ?? s.date);
        const slot = { ...toSlot(s), sessionId: undefined, date, startTime: s.class.startTime, endTime: s.class.endTime, roomId: s.class.roomId };
        slot.staffIds = [s.class.teacherId, ...s.class.assistants.map((a) => a.teacherId)];
        await assertNoConflicts(tx, [slot]);
        appended = await tx.classSession.create({
          data: {
            classId: s.classId,
            index: (maxIndex._max.index ?? 0) + 1,
            date,
            startTime: s.class.startTime,
            endTime: s.class.endTime,
            roomId: s.class.roomId,
            teacherId: s.class.teacherId,
            note: `Bù cho buổi ${s.date.split("-").reverse().join("/")}`,
          },
        });
      }
      await logChange(tx, "Session", id, "cancel", {
        status: [s.status, "CANCELLED"],
        reason: [null, input.reason],
        ...(appended ? { appended: [null, appended.date] } : {}),
      });
      await logChange(tx, "Class", s.classId, "session-cancel", { session: [s.date, null], ...(appended ? { appended: [null, appended.date] } : {}) });
      return { ok: true, appended };
    }

    if (input.action === "restore") {
      if (s.status !== "CANCELLED") throw badRequest("Buổi này chưa bị hủy");
      await assertNoConflicts(tx, [toSlot(s)]);
      await tx.classSession.update({ where: { id }, data: { status: "SCHEDULED", note: null } });
      await logChange(tx, "Session", id, "restore", { status: ["CANCELLED", "SCHEDULED"] });
      return { ok: true };
    }

    // change: dời ngày/giờ, đổi phòng, dạy thay
    const next = {
      date: input.date ?? s.date,
      startTime: input.startTime ?? s.startTime,
      endTime: input.endTime ?? s.endTime,
      roomId: input.roomId ?? s.roomId,
      teacherId: input.teacherId ?? s.teacherId,
    };
    if (next.startTime >= next.endTime) throw badRequest("Giờ kết thúc phải sau giờ bắt đầu");
    const room = await tx.room.findUnique({ where: { id: next.roomId } });
    if (!room || room.centerId !== s.class.centerId) throw badRequest("Phòng không thuộc trung tâm của lớp");
    if (next.teacherId !== s.teacherId) {
      const t = await tx.teacher.findUnique({ where: { id: next.teacherId } });
      if (!t || t.status !== "ACTIVE") throw badRequest("Người dạy thay không hợp lệ hoặc không còn đang làm");
      if (t.role === "ASSISTANT") throw badRequest(`${t.displayName} là trợ giảng, không thể dạy chính`);
    }
    if (s.status !== "CANCELLED") {
      await assertNoConflicts(tx, [
        {
          ...toSlot(s),
          ...next,
          roomName: room.name,
          staffIds: [next.teacherId, ...s.class.assistants.map((a) => a.teacherId)],
        },
      ]);
    }
    const after = await tx.classSession.update({ where: { id }, data: { ...next, note: input.note ?? s.note } });
    const changes: Record<string, [unknown, unknown]> = {};
    for (const k of Object.keys(next) as (keyof typeof next)[]) if (s[k] !== next[k]) changes[k] = [s[k], next[k]];
    await logChange(tx, "Session", id, "update", changes);
    if (Object.keys(changes).length > 0) {
      await logChange(tx, "Class", s.classId, "session-change", { session: [s.date, next.date], ...changes });
    }
    return after;
  });
});
