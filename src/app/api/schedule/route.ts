import { addDays, todayISO } from "@/lib/dates";
import { isStaff } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { route } from "@/server/http";

/** Buổi học trong khoảng ngày, lọc theo trung tâm / giáo viên / phòng / lớp. */
export const GET = route(async (req, _ctx, viewer) => {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ?? todayISO();
  const to = sp.get("to") ?? from;
  const centerId = Number(sp.get("centerId")) || undefined;
  // Giáo viên, trợ giảng chỉ xem lịch của mình.
  const teacherId = isStaff(viewer) ? (viewer.teacherId ?? -1) : Number(sp.get("teacherId")) || undefined;
  const roomId = Number(sp.get("roomId")) || undefined;
  const classId = Number(sp.get("classId")) || undefined;
  if (to < from || addDays(from, 62) < to) return [];
  const sessions = await prisma.classSession.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(roomId ? { roomId } : {}),
      ...(classId ? { classId } : {}),
      ...(centerId ? { class: { centerId } } : {}),
      ...(teacherId
        ? { OR: [{ teacherId }, { class: { assistants: { some: { teacherId } } } }] }
        : {}),
    },
    include: {
      _count: { select: { makeups: true, attendances: true } },
      room: { select: { id: true, name: true } },
      teacher: { select: { id: true, displayName: true } },
      class: {
        select: {
          id: true,
          code: true,
          name: true,
          teacherId: true,
          courseId: true,
          center: { select: { id: true, name: true, color: true } },
          assistants: { select: { teacher: { select: { id: true, displayName: true } } } },
          _count: { select: { enrollments: { where: { leftAt: null } } } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  // Bài theo khung chương trình (buổi số N lấy bài số N của khóa) để giáo viên biết hôm nay dạy gì.
  const courseIds = [...new Set(sessions.map((s) => s.class.courseId).filter((id): id is number => id != null))];
  const lessons = courseIds.length
    ? await prisma.courseLesson.findMany({ where: { courseId: { in: courseIds } }, select: { courseId: true, index: true, title: true, testKind: true } })
    : [];
  const byKey = new Map(lessons.map((l) => [`${l.courseId}:${l.index}`, { title: l.title, testKind: l.testKind }]));
  return sessions.map((s) => ({ ...s, lesson: byKey.get(`${s.class.courseId}:${s.index}`) ?? null }));
});
