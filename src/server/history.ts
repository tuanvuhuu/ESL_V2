// E2: dữ liệu trang lịch sử học tập của một học sinh: mọi ghi danh kèm từng buổi đã điểm danh,
// bài theo khung chương trình của buổi, kết quả chấm bài tập, điểm kiểm tra.
import type { Prisma } from "@prisma/client";
import { balancesFor } from "./attendance";
import { prisma } from "./db";
import { notFound } from "./http";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function learningHistory(tx: Tx, studentId: number) {
  const s = await tx.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      code: true,
      fullName: true,
      englishName: true,
      dob: true,
      status: true,
      center: { select: { name: true, color: true } },
      enrollments: {
        orderBy: { joinedAt: "desc" },
        select: {
          id: true,
          joinedAt: true,
          leftAt: true,
          transferredFromId: true,
          outcome: true,
          finalComment: true,
          outcomeBy: true,
          class: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              centerId: true,
              teacherId: true,
              teacher: { select: { displayName: true } },
              course: { select: { name: true, nextCourse: { select: { name: true } } } },
              center: { select: { name: true, color: true } },
            },
          },
          attendances: {
            orderBy: { session: { date: "asc" } },
            select: {
              id: true,
              status: true,
              comment: true,
              homework: true,
              makeupId: true,
              session: {
                select: {
                  id: true,
                  index: true,
                  date: true,
                  startTime: true,
                  lessonContent: true,
                  teacher: { select: { displayName: true } },
                  class: { select: { code: true, courseId: true } },
                },
              },
            },
          },
          scores: {
            orderBy: { session: { date: "asc" } },
            select: {
              id: true,
              kind: true,
              listening: true,
              speaking: true,
              reading: true,
              writing: true,
              total: true,
              note: true,
              session: { select: { id: true, index: true, date: true, class: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });
  if (!s) throw notFound("Không tìm thấy học sinh");

  // Bài theo khung của từng buổi (buổi số N lấy bài số N của khóa lớp đó, kể cả buổi học bù ở lớp khác).
  const pairs = s.enrollments.flatMap((e) => e.attendances.map((a) => a.session)).filter((x) => x.class.courseId != null);
  const lessons = pairs.length
    ? await tx.courseLesson.findMany({
        where: { OR: [...new Set(pairs.map((x) => x.class.courseId!))].map((courseId) => ({ courseId, index: { in: pairs.filter((p) => p.class.courseId === courseId).map((p) => p.index) } })) },
        select: { courseId: true, index: true, title: true, testKind: true },
      })
    : [];
  const lessonOf = new Map(lessons.map((l) => [`${l.courseId}:${l.index}`, { title: l.title, testKind: l.testKind }]));
  const balances = await balancesFor(tx, s.enrollments.map((e) => e.id));

  return {
    ...s,
    enrollments: s.enrollments.map((e) => ({
      ...e,
      balance: balances.get(e.id) ?? null,
      attendances: e.attendances.map((a) => ({ ...a, lesson: lessonOf.get(`${a.session.class.courseId}:${a.session.index}`) ?? null })),
    })),
  };
}
