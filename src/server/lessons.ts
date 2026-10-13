// E1: bài giảng và bài tập theo buổi của một lớp. Buổi số N lấy bài số N của khung chương trình (CourseLesson).
import type { Prisma } from "@prisma/client";
import { isAttended } from "@/lib/attendance";
import { assignedHomework, homeworkStats, parseMaterials } from "@/lib/curriculum";
import { prisma } from "./db";
import { notFound } from "./http";

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * Bài tập cần kiểm tra ở buổi này: bài tập giao ở buổi gần nhất trước đó (không tính buổi hủy).
 * Trả về null khi đây là buổi đầu tiên.
 */
export async function homeworkToCheck(tx: Tx, s: { classId: number; index: number; class: { courseId: number | null } }) {
  const prev = await tx.classSession.findFirst({
    where: { classId: s.classId, index: { lt: s.index }, status: { not: "CANCELLED" } },
    orderBy: { index: "desc" },
    select: { id: true, index: true, date: true, homework: true },
  });
  if (!prev) return null;
  const lesson = s.class.courseId
    ? await tx.courseLesson.findUnique({ where: { courseId_index: { courseId: s.class.courseId, index: prev.index } }, select: { title: true, homework: true } })
    : null;
  return {
    sessionId: prev.id,
    index: prev.index,
    date: prev.date,
    lessonTitle: lesson?.title ?? null,
    text: assignedHomework(prev.homework, lesson?.homework),
  };
}

/** Kế hoạch bài giảng của lớp: từng buổi kèm bài theo khung, nội dung đã dạy, bài tập giao và kết quả chấm bài tập. */
export async function classLessonPlan(tx: Tx, classId: number) {
  const c = await tx.classGroup.findUnique({
    where: { id: classId },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      courseId: true,
      course: { select: { id: true, name: true, totalSessions: true } },
      center: { select: { id: true, name: true, color: true } },
      teacher: { select: { displayName: true } },
      sessions: {
        orderBy: [{ index: "asc" }, { date: "asc" }],
        select: {
          id: true,
          index: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          lessonContent: true,
          homework: true,
          attendanceTakenAt: true,
          teacher: { select: { displayName: true } },
          attendances: { select: { status: true, homework: true } },
        },
      },
    },
  });
  if (!c) throw notFound("Không tìm thấy lớp");
  const lessons = c.courseId ? await tx.courseLesson.findMany({ where: { courseId: c.courseId }, orderBy: { index: "asc" } }) : [];
  const byIndex = new Map(lessons.map((l) => [l.index, { ...l, materials: parseMaterials(l.materials) }]));
  const { sessions, ...cls } = c;
  return {
    class: cls,
    lessonCount: lessons.length,
    sessions: sessions.map(({ attendances, ...s }) => {
      const lesson = byIndex.get(s.index) ?? null;
      return {
        ...s,
        lesson,
        assignedHomework: assignedHomework(s.homework, lesson?.homework),
        present: attendances.filter((a) => isAttended(a.status)).length,
        roster: attendances.length,
        /** Kết quả chấm ở buổi này, tức bài tập của buổi trước. */
        homeworkChecked: homeworkStats(attendances.map((a) => a.homework)),
      };
    }),
  };
}
