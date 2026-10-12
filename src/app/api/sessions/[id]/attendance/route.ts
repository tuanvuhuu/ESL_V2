import { attendanceOption, isAttended } from "@/lib/attendance";
import { todayISO } from "@/lib/dates";
import { assertCanTakeAttendance, assertCanViewAttendance, canTakeAttendanceFor, loadSession, rosterFor, staffRoleIn } from "@/server/attendance";
import { logChange } from "@/server/audit";
import { currentActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { badRequest, body, idParam, route, type IdCtx } from "@/server/http";
import { attendanceSchema } from "@/server/validators";

/** Màn hình điểm danh (G2): thông tin buổi và danh sách học sinh kèm trạng thái đã lưu. */
export const GET = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  const s = await loadSession(prisma, id);
  assertCanViewAttendance(viewer, s);
  const roster = await rosterFor(prisma, s);
  return {
    session: s,
    roster,
    role: staffRoleIn(viewer, s),
    canEdit: canTakeAttendanceFor(viewer, s) && s.status !== "CANCELLED" && s.date <= todayISO(),
  };
});

/** Lưu điểm danh cả buổi. Lưu lại được nhiều lần; mỗi thay đổi ghi vào lịch sử. */
export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const input = await body(req, attendanceSchema);
  return prisma.$transaction(async (tx) => {
    const s = await loadSession(tx, id);
    assertCanTakeAttendance(viewer, s);
    if (s.status === "CANCELLED") throw badRequest("Buổi này đã hủy, không điểm danh được");
    if (s.date > todayISO()) throw badRequest("Chưa đến ngày học, chưa điểm danh được");
    const roster = await rosterFor(tx, s);
    const byStudent = new Map(roster.map((r) => [r.studentId, r]));
    const actor = currentActor();
    const changes: Record<string, [unknown, unknown]> = {};
    for (const item of input.items) {
      const r = byStudent.get(item.studentId);
      if (!r) throw badRequest("Có học sinh không thuộc buổi học này, tải lại trang rồi điểm danh lại");
      if (r.status === item.status && r.comment === item.comment) continue;
      await tx.attendance.upsert({
        where: { sessionId_studentId: { sessionId: id, studentId: item.studentId } },
        create: {
          sessionId: id,
          studentId: item.studentId,
          enrollmentId: r.enrollmentId,
          status: item.status,
          comment: item.comment,
          makeupId: r.makeup?.id ?? null,
          takenBy: actor,
        },
        update: { status: item.status, comment: item.comment, takenBy: actor },
      });
      // Sửa từ vắng thành có mặt: bỏ lịch học bù chưa diễn ra của buổi này.
      if (isAttended(item.status)) {
        await tx.makeup.deleteMany({ where: { absence: { sessionId: id, studentId: item.studentId }, attendance: { is: null } } });
      }
      const label = (v: string | null) => (v ? (attendanceOption(v)?.label ?? v) : null);
      if (r.status !== item.status) {
        changes[r.fullName] = [label(r.status), label(item.status)];
        await logChange(tx, "Student", item.studentId, "attendance", {
          [`Buổi ${s.date.split("-").reverse().join("/")} · ${s.class.code}`]: [label(r.status), label(item.status)],
        });
      }
    }
    if (s.lessonContent !== input.lessonContent) changes.lessonContent = [s.lessonContent, input.lessonContent];
    await tx.classSession.update({
      where: { id },
      data: { lessonContent: input.lessonContent, attendanceTakenAt: new Date(), attendanceBy: actor },
    });
    await logChange(tx, "Session", id, s.attendanceTakenAt ? "attendance-update" : "attendance", changes);
    if (!s.attendanceTakenAt) await logChange(tx, "Class", s.classId, "attendance", { session: [null, s.date] });
    return { ok: true };
  });
});
