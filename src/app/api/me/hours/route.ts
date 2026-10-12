import { sessionMinutes } from "@/lib/attendance";
import { todayISO } from "@/lib/dates";
import { isStaff } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { allow, badRequest, route } from "@/server/http";

/** Giờ dạy trong tháng (G5): buổi đã dạy chính, buổi trợ giảng; tách đã diễn ra và sắp tới. */
export const GET = route(async (req, _ctx, viewer) => {
  allow(isStaff(viewer) && viewer.teacherId != null, "Trang này dành cho giáo viên, trợ giảng");
  const teacherId = viewer.teacherId!;
  const month = new URL(req.url).searchParams.get("month") ?? todayISO().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest("Tháng không hợp lệ");
  const sessions = await prisma.classSession.findMany({
    where: {
      status: "SCHEDULED",
      date: { gte: `${month}-01`, lte: `${month}-31` },
      OR: [{ teacherId }, { class: { assistants: { some: { teacherId } } } }],
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      teacherId: true,
      attendanceTakenAt: true,
      class: { select: { id: true, code: true, name: true, teacherId: true, center: { select: { name: true, color: true } } } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  const today = todayISO();
  const rows = sessions.map((s) => ({
    ...s,
    role: s.teacherId === teacherId ? "teacher" : "assistant",
    substitute: s.teacherId === teacherId && s.class.teacherId !== teacherId,
    minutes: sessionMinutes(s.startTime, s.endTime),
    done: s.date <= today,
  }));
  const sum = (role: string, done: boolean) =>
    rows.filter((r) => r.role === role && r.done === done).reduce((n, r) => ({ sessions: n.sessions + 1, minutes: n.minutes + r.minutes }), { sessions: 0, minutes: 0 });
  return {
    month,
    sessions: rows,
    totals: {
      teacher: { done: sum("teacher", true), upcoming: sum("teacher", false) },
      assistant: { done: sum("assistant", true), upcoming: sum("assistant", false) },
    },
  };
});
