import { addDays, todayISO } from "@/lib/dates";
import { prisma } from "@/server/db";
import { route } from "@/server/http";

/** Buổi học trong khoảng ngày, lọc theo trung tâm / giáo viên / phòng / lớp. */
export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ?? todayISO();
  const to = sp.get("to") ?? from;
  const centerId = Number(sp.get("centerId")) || undefined;
  const teacherId = Number(sp.get("teacherId")) || undefined;
  const roomId = Number(sp.get("roomId")) || undefined;
  const classId = Number(sp.get("classId")) || undefined;
  if (to < from || addDays(from, 62) < to) return [];
  return prisma.classSession.findMany({
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
      room: { select: { id: true, name: true } },
      teacher: { select: { id: true, displayName: true } },
      class: {
        select: {
          id: true,
          code: true,
          name: true,
          teacherId: true,
          center: { select: { id: true, name: true, color: true } },
          assistants: { select: { teacher: { select: { id: true, displayName: true } } } },
          _count: { select: { enrollments: { where: { leftAt: null } } } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
});
