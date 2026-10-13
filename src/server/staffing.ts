// Lịch rảnh, ngày nghỉ của giáo viên / trợ giảng và gợi ý người dạy thay.
import type { Prisma } from "@prisma/client";
import { availabilityFor, inRange } from "@/lib/availability";
import { formatDateVN } from "@/lib/dates";
import { levelMatch, type LevelMatch } from "@/lib/levels";
import { canManageTeacherTime, canSeeTeachers, type Viewer } from "@/lib/permissions";
import { overlaps } from "@/lib/schedule";
import { prisma } from "./db";
import { allow, notFound } from "./http";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Hồ sơ người dạy kèm trung tâm; giáo viên, trợ giảng chỉ mở được của mình. */
export async function loadTeacherForTime(tx: Tx, v: Viewer, teacherId: number) {
  if (!canSeeTeachers(v) && v.teacherId !== teacherId) throw notFound("Không tìm thấy giáo viên");
  const t = await tx.teacher.findUnique({ where: { id: teacherId }, include: { centers: true } });
  if (!t) throw notFound("Không tìm thấy giáo viên");
  return t;
}

export function assertCanManageTime(v: Viewer, t: { id: number; centers: { centerId: number }[] }) {
  allow(
    canManageTeacherTime(
      v,
      t.id,
      t.centers.map((c) => c.centerId),
    ),
    "Chỉ quản lý, giáo vụ trung tâm của người này hoặc chính người đó được sửa lịch rảnh, ngày nghỉ",
  );
}

export type AffectedSession = {
  id: number;
  index: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  /** Người nghỉ là người dạy buổi, giáo viên chính đã có người dạy thay, hay trợ giảng. */
  role: "teacher" | "substituted" | "assistant";
  teacher: { id: number; displayName: string };
  class: { id: number; code: string; name: string; centerId: number; center: { name: string; color: string } };
};

/** Các buổi của một người trong khoảng ngày: buổi người đó dạy, buổi của lớp người đó làm giáo viên chính hoặc trợ giảng. */
export async function affectedSessions(tx: Tx, teacherId: number, fromDate: string, toDate: string): Promise<AffectedSession[]> {
  const rows = await tx.classSession.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      OR: [{ teacherId }, { class: { teacherId } }, { class: { assistants: { some: { teacherId } } } }],
    },
    include: {
      teacher: { select: { id: true, displayName: true } },
      class: {
        select: { id: true, code: true, name: true, centerId: true, teacherId: true, center: { select: { name: true, color: true } }, assistants: true },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    index: s.index,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    role: s.teacherId === teacherId ? "teacher" : s.class.teacherId === teacherId ? "substituted" : "assistant",
    teacher: s.teacher,
    class: { id: s.class.id, code: s.class.code, name: s.class.name, centerId: s.class.centerId, center: s.class.center },
  }));
}

export type Candidate = {
  id: number;
  displayName: string;
  fullName: string;
  current: boolean;
  availability: "FREE" | "OUTSIDE" | "UNKNOWN";
  onLeave: string | null;
  busy: string | null;
  /** Bận ở trung tâm khác cùng giờ: lưu sẽ bị chặn. */
  blocked: boolean;
  teachesCenter: boolean;
  taughtCourse: boolean;
  /** B5: cấp độ dạy được của người này so với cấp độ của khóa. */
  levelMatch: LevelMatch;
  score: number;
};

/** Danh sách người có thể dạy thay một buổi, sắp theo mức phù hợp (DESIGN 6.3). */
export async function substituteCandidates(tx: Tx, sessionId: number): Promise<Candidate[]> {
  const s = await tx.classSession.findUnique({
    where: { id: sessionId },
    include: { class: { select: { id: true, centerId: true, courseId: true, assistants: true, course: { select: { level: true } } } } },
  });
  if (!s) throw notFound("Không tìm thấy buổi học");
  const [teachers, sameDay] = await Promise.all([
    tx.teacher.findMany({
      where: { status: "ACTIVE", role: { not: "ASSISTANT" } },
      include: {
        centers: true,
        availability: true,
        leaves: { where: { fromDate: { lte: s.date }, toDate: { gte: s.date } } },
        mainClasses: { select: { courseId: true } },
        sessions: { where: { class: { courseId: s.class.courseId ?? -1 } }, select: { id: true }, take: 1 },
      },
      orderBy: { displayName: "asc" },
    }),
    tx.classSession.findMany({
      where: { date: s.date, status: { not: "CANCELLED" }, id: { not: s.id } },
      include: { class: { select: { code: true, centerId: true, center: { select: { name: true } }, assistants: true } } },
    }),
  ]);
  return teachers
    .map((t) => {
      const availability = availabilityFor(t.availability, s.date, s.startTime, s.endTime, s.class.centerId);
      const leave = t.leaves.find((l) => inRange(l, s.date));
      const clash = sameDay.find(
        (o) =>
          (o.teacherId === t.id || o.class.assistants.some((a) => a.teacherId === t.id)) &&
          overlaps(o.startTime, o.endTime, s.startTime, s.endTime),
      );
      const teachesCenter = t.centers.some((c) => c.centerId === s.class.centerId);
      const taughtCourse = s.class.courseId != null && (t.mainClasses.some((c) => c.courseId === s.class.courseId) || t.sessions.length > 0);
      const level = levelMatch(t.teachableLevels, s.class.course?.level);
      const blocked = !!clash && clash.class.centerId !== s.class.centerId;
      const score =
        (availability === "FREE" ? 4 : availability === "UNKNOWN" ? 2 : 0) +
        (teachesCenter ? 2 : 0) +
        (taughtCourse ? 1 : 0) +
        (level === "MATCH" ? 3 : level === "MISMATCH" ? -3 : 0) -
        (clash ? 10 : 0) -
        (leave ? 20 : 0);
      return {
        id: t.id,
        displayName: t.displayName,
        fullName: t.fullName,
        current: t.id === s.teacherId,
        availability,
        onLeave: leave ? `Nghỉ ${formatDateVN(leave.fromDate)}–${formatDateVN(leave.toDate)}: ${leave.reason}` : null,
        busy: clash ? `Đang dạy ${clash.class.code} (${clash.class.center.name}) ${clash.startTime}–${clash.endTime}` : null,
        blocked,
        teachesCenter,
        taughtCourse,
        levelMatch: level,
        score,
      };
    })
    .sort((a, b) => Number(a.current) - Number(b.current) || b.score - a.score || a.displayName.localeCompare(b.displayName, "vi"));
}
