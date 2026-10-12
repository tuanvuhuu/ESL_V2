import { formatDateVN } from "@/lib/dates";
import { findConflicts, generateSessionDates } from "@/lib/schedule";
import { assertCanEditClass } from "@/server/access";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { badRequest, body, conflict, idParam, notFound, route, type IdCtx } from "@/server/http";
import { loadSlots, toSlot } from "@/server/slots";
import { classBulkSchema } from "@/server/validators";

/**
 * Thao tác hàng loạt ở hồ sơ lớp (M14):
 * - "teacher": đổi giáo viên chính từ ngày X; các buổi từ ngày đó đang do giáo viên cũ dạy chuyển sang người mới (buổi dạy thay giữ nguyên).
 * - "shift": dời các buổi chưa điểm danh từ ngày X, xếp lại theo thứ lặp của lớp bắt đầu từ ngày Y, bỏ ngày lễ.
 * Cả hai đều chặn trùng phòng, trùng người dạy như khi mở lớp.
 */
export const POST = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const input = await body(req, classBulkSchema);
  return prisma.$transaction(async (tx) => {
    await assertCanEditClass(tx, viewer, id);
    const cls = await tx.classGroup.findUnique({ where: { id }, include: { assistants: true } });
    if (!cls) throw notFound("Không tìm thấy lớp");
    if (cls.status === "FINISHED" || cls.status === "CANCELLED") throw badRequest(`Lớp ${cls.code} đã kết thúc hoặc đã hủy`);
    const sessionInclude = { room: true, class: { include: { center: true, assistants: true } } } as const;

    if (input.action === "teacher") {
      const t = await tx.teacher.findUnique({ where: { id: input.teacherId }, include: { centers: true } });
      if (!t) throw notFound("Không tìm thấy giáo viên");
      if (t.id === cls.teacherId) throw badRequest(`${t.displayName} đang là giáo viên chính của lớp`);
      if (t.status !== "ACTIVE") throw badRequest(`${t.displayName} không còn ở trạng thái đang làm`);
      if (t.role === "ASSISTANT") throw badRequest(`${t.displayName} là trợ giảng, không thể làm giáo viên chính`);
      if (cls.assistants.some((a) => a.teacherId === t.id)) throw badRequest(`${t.displayName} đang là trợ giảng của lớp`);
      if (!t.centers.some((c) => c.centerId === cls.centerId)) throw badRequest(`${t.displayName} chưa được gắn với trung tâm của lớp`);
      const sessions = await tx.classSession.findMany({
        where: { classId: id, status: "SCHEDULED", date: { gte: input.fromDate }, teacherId: cls.teacherId, attendanceTakenAt: null },
        include: sessionInclude,
      });
      const candidates = sessions.map((s) => ({ ...toSlot(s), staffIds: [t.id, ...s.class.assistants.map((a) => a.teacherId)] }));
      const found = findConflicts(candidates, await loadSlots(tx, candidates.map((c) => c.date)), { [t.id]: t.displayName });
      if (found.length) throw conflict(`Không thể đổi: ${found[0].message}`, found.map((c) => c.message));
      await tx.classSession.updateMany({ where: { id: { in: sessions.map((s) => s.id) } }, data: { teacherId: t.id } });
      const old = await tx.teacher.findUniqueOrThrow({ where: { id: cls.teacherId } });
      await tx.classGroup.update({ where: { id }, data: { teacherId: t.id } });
      await logChange(tx, "Class", id, "bulk", { teacher: [old.displayName, t.displayName], fromDate: [null, input.fromDate], sessions: [null, sessions.length] });
      return { changed: sessions.length };
    }

    const sessions = await tx.classSession.findMany({
      where: { classId: id, status: "SCHEDULED", date: { gte: input.fromDate } },
      include: sessionInclude,
      orderBy: [{ date: "asc" }, { index: "asc" }],
    });
    if (sessions.length === 0) throw badRequest(`Lớp không còn buổi nào từ ${formatDateVN(input.fromDate)}`);
    const taken = sessions.find((s) => s.attendanceTakenAt);
    if (taken) throw conflict(`Buổi ${formatDateVN(taken.date)} đã điểm danh, không dời được. Chọn ngày bắt đầu sau buổi đó.`);
    const prev = await tx.classSession.findFirst({
      where: { classId: id, status: "SCHEDULED", date: { lt: input.fromDate } },
      orderBy: { date: "desc" },
    });
    if (prev && input.newDate <= prev.date) throw badRequest(`Ngày học lại phải sau buổi ${formatDateVN(prev.date)} của lớp`);
    const holidays = await tx.holiday.findMany({ where: { date: { gte: input.newDate } } });
    const { dates } = generateSessionDates({
      startDate: input.newDate,
      weekdays: cls.weekdays.split(",").map(Number),
      totalSessions: sessions.length,
      centerId: cls.centerId,
      holidays,
    });
    if (dates.length < sessions.length) throw badRequest("Không xếp được đủ buổi từ ngày đã chọn");
    const moving = new Set(sessions.map((s) => s.id));
    const candidates = sessions.map((s, i) => ({ ...toSlot(s), date: dates[i] }));
    const existing = (await loadSlots(tx, dates)).filter((e) => !moving.has(e.sessionId!));
    const names = Object.fromEntries((await tx.teacher.findMany({ select: { id: true, displayName: true } })).map((t) => [t.id, t.displayName]));
    const found = findConflicts(candidates, existing, names);
    if (found.length) throw conflict(`Không thể dời: ${found[0].message}`, found.map((c) => c.message));
    for (const [i, s] of sessions.entries()) {
      if (s.date === dates[i]) continue;
      await tx.classSession.update({
        where: { id: s.id },
        data: { date: dates[i], note: [s.note, `Dời từ ${formatDateVN(s.date)}: ${input.reason}`].filter(Boolean).join("; ") },
      });
    }
    await logChange(tx, "Class", id, "bulk", {
      shift: [formatDateVN(sessions[0].date), formatDateVN(dates[0])],
      sessions: [null, sessions.length],
      reason: [null, input.reason],
    });
    return { changed: sessions.length, from: dates[0], to: dates[dates.length - 1] };
  });
});
