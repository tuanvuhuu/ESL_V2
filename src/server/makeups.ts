// Học bù (luồng L6): tìm buổi vắng chưa bù và gợi ý buổi để bù.
import type { Prisma } from "@prisma/client";
import { overlaps } from "@/lib/schedule";
import { todayISO } from "@/lib/dates";
import { prisma } from "./db";
import { notFound } from "./http";

type Tx = Prisma.TransactionClient | typeof prisma;

export const absenceInclude = {
  student: { select: { id: true, code: true, fullName: true, englishName: true, centerId: true, status: true, center: { select: { id: true, name: true, color: true } } } },
  session: {
    select: {
      id: true,
      index: true,
      date: true,
      startTime: true,
      endTime: true,
      class: { select: { id: true, code: true, name: true, courseId: true, centerId: true, course: { select: { name: true } } } },
    },
  },
  makeupFor: { select: { id: true } },
} satisfies Prisma.AttendanceInclude;

export async function loadAbsence(tx: Tx, id: number) {
  const a = await tx.attendance.findUnique({ where: { id }, include: absenceInclude });
  if (!a) throw notFound("Không tìm thấy buổi vắng");
  return a;
}

/** Số chỗ còn trống của buổi: sức chứa lớp/phòng trừ học sinh trong lớp và học sinh đã xếp học bù. */
export async function seatsLeft(tx: Tx, sessionIds: number[]) {
  const sessions = await tx.classSession.findMany({
    where: { id: { in: sessionIds } },
    select: {
      id: true,
      date: true,
      room: { select: { capacity: true } },
      class: { select: { maxStudents: true, enrollments: { select: { joinedAt: true, leftAt: true } } } },
      _count: { select: { makeups: true } },
    },
  });
  return new Map(
    sessions.map((s) => {
      const inClass = s.class.enrollments.filter((e) => e.joinedAt <= s.date && (!e.leftAt || e.leftAt > s.date)).length;
      return [s.id, Math.min(s.class.maxStudents, s.room.capacity) - inClass - s._count.makeups];
    }),
  );
}

/** Buổi gợi ý để bù: cùng khóa, lớp khác, từ hôm nay, còn chỗ, không trùng giờ học của học sinh. Ưu tiên cùng buổi số, trung tâm chính. */
export async function makeupOptions(tx: Tx, absenceId: number) {
  const a = await loadAbsence(tx, absenceId);
  const today = todayISO();
  const cls = a.session.class;
  const candidates = await tx.classSession.findMany({
    where: {
      status: "SCHEDULED",
      date: { gte: today },
      classId: { not: cls.id },
      class: { status: { in: ["PLANNED", "ACTIVE"] }, ...(cls.courseId ? { courseId: cls.courseId } : { centerId: cls.centerId }) },
    },
    include: {
      room: { select: { name: true } },
      teacher: { select: { displayName: true } },
      class: { select: { id: true, code: true, name: true, center: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 300,
  });
  const seats = await seatsLeft(tx, candidates.map((c) => c.id));
  // Giờ học của học sinh ở các lớp đang theo, để loại buổi trùng giờ.
  const busy = await tx.classSession.findMany({
    where: {
      status: "SCHEDULED",
      date: { in: [...new Set(candidates.map((c) => c.date))] },
      OR: [
        { class: { enrollments: { some: { studentId: a.studentId, leftAt: null } } } },
        { makeups: { some: { studentId: a.studentId } } },
      ],
    },
    select: { date: true, startTime: true, endTime: true },
  });
  return candidates
    .filter((c) => (seats.get(c.id) ?? 0) > 0)
    .filter((c) => !busy.some((b) => b.date === c.date && overlaps(b.startTime, b.endTime, c.startTime, c.endTime)))
    .map((c) => ({ ...c, seatsLeft: seats.get(c.id) ?? 0, sameIndex: c.index === a.session.index, sameCenter: c.class.center.id === a.student.centerId }))
    .sort(
      (x, y) =>
        Math.abs(x.index - a.session.index) - Math.abs(y.index - a.session.index) ||
        Number(y.sameCenter) - Number(x.sameCenter) ||
        x.date.localeCompare(y.date) ||
        x.startTime.localeCompare(y.startTime),
    )
    .slice(0, 20);
}
