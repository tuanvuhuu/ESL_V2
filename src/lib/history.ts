// Lịch sử học tập theo khóa: gộp các ghi danh nối nhau qua chuyển lớp thành một khóa,
// tính chuyên cần, gom nhận xét của giáo viên. Dùng chung cho hồ sơ học sinh và trang in gửi phụ huynh.
import { isAttended, type Balance } from "./attendance";
import { homeworkStats, SKILLS, testKindOption, type HomeworkStats, type SkillKey } from "./curriculum";
import { formatDateVN } from "./dates";

export type HistoryAttendance = {
  id: number;
  status: string;
  comment: string | null;
  /** E1: kết quả chấm bài tập buổi trước (DONE, PARTIAL, MISSING). */
  homework?: string | null;
  /** Có giá trị khi đây là lượt học bù (học ở lớp khác). */
  makeupId: number | null;
  session: { index: number; date: string; startTime: string; lessonContent: string | null; class: { code: string } };
};

/** Điểm kiểm tra theo kỹ năng (src/lib/curriculum.ts). */
export type HistoryScore = {
  id: number;
  kind: string;
  listening: number | null;
  speaking: number | null;
  reading: number | null;
  writing: number | null;
  total: number | null;
  note: string | null;
  session: { id?: number; index: number; date: string; class: { code: string } };
};

export type HistoryEnrollment = {
  id: number;
  joinedAt: string;
  leftAt: string | null;
  transferredFromId: number | null;
  outcome: string | null;
  finalComment: string | null;
  outcomeBy: string | null;
  balance: Balance | null;
  attendances: HistoryAttendance[];
  scores?: HistoryScore[];
  class: {
    id: number;
    code: string;
    name: string;
    status: string;
    centerId?: number;
    teacher: { displayName: string };
    course: { name: string; nextCourse?: { name: string } | null } | null;
    center: { name: string; color: string };
  };
};

export type AttendanceSummary = {
  /** Số buổi của lớp mình đã điểm danh. */
  held: number;
  present: number;
  late: number;
  excused: number;
  unexcused: number;
  /** Buổi vắng đã học bù ở lớp khác. */
  madeUp: number;
  /** Tỉ lệ đi học (có mặt + muộn + học bù) / số buổi, 0–100. Trống khi chưa có buổi nào. */
  rate: number | null;
};

export type CourseRun<E extends HistoryEnrollment = HistoryEnrollment> = {
  /** Ghi danh đầu tiên của khóa, dùng làm khóa để in riêng từng khóa. */
  key: number;
  courseName: string;
  enrollments: E[];
  /** Ghi danh cuối cùng: lớp hiện tại hoặc lớp kết thúc khóa. */
  last: E;
  from: string;
  to: string | null;
  ongoing: boolean;
  teachers: string[];
  summary: AttendanceSummary;
  comments: { date: string; classCode: string; comment: string }[];
  /** Điểm kiểm tra của cả khóa, theo ngày. */
  scores: HistoryScore[];
  /** Khóa tiếp theo gợi ý của khóa này. */
  nextCourseName: string | null;
  /** E2: kết quả chấm bài tập cả khóa. */
  homework: HomeworkStats;
};

export function summarize(attendances: Pick<HistoryAttendance, "status" | "makeupId">[]): AttendanceSummary {
  const own = attendances.filter((a) => !a.makeupId);
  const count = (s: string) => own.filter((a) => a.status === s).length;
  const madeUp = attendances.filter((a) => a.makeupId && isAttended(a.status)).length;
  const attended = own.filter((a) => isAttended(a.status)).length;
  return {
    held: own.length,
    present: count("PRESENT"),
    late: count("LATE"),
    excused: count("EXCUSED"),
    unexcused: count("UNEXCUSED"),
    madeUp,
    rate: own.length ? Math.min(100, Math.round(((attended + madeUp) / own.length) * 100)) : null,
  };
}

/**
 * Gộp ghi danh thành từng khóa: ghi danh chuyển từ lớp khác nối vào khóa của ghi danh gốc.
 * Khóa mới nhất đứng trước.
 */
export function buildCourseHistory<E extends HistoryEnrollment>(enrollments: E[]): CourseRun<E>[] {
  const byId = new Map(enrollments.map((e) => [e.id, e]));
  const next = new Map<number, E>();
  for (const e of enrollments) if (e.transferredFromId && byId.has(e.transferredFromId)) next.set(e.transferredFromId, e);
  const roots = enrollments.filter((e) => !e.transferredFromId || !byId.has(e.transferredFromId));
  const runs = roots.map((root) => {
    const chain: E[] = [root];
    for (let cur = next.get(root.id); cur && !chain.includes(cur); cur = next.get(cur.id)) chain.push(cur);
    const last = chain[chain.length - 1];
    const attendances = chain.flatMap((e) => e.attendances).sort((a, b) => a.session.date.localeCompare(b.session.date) || a.session.startTime.localeCompare(b.session.startTime));
    const ongoing = !last.leftAt && !["FINISHED", "CANCELLED"].includes(last.class.status);
    const lastDate = attendances[attendances.length - 1]?.session.date ?? null;
    return {
      key: root.id,
      courseName: last.class.course?.name ?? last.class.name,
      enrollments: chain,
      last,
      from: root.joinedAt,
      to: ongoing ? null : (last.leftAt ?? lastDate),
      ongoing,
      teachers: [...new Set(chain.map((e) => e.class.teacher.displayName))],
      summary: summarize(attendances),
      comments: attendances
        .filter((a) => a.comment)
        .map((a) => ({ date: a.session.date, classCode: a.session.class.code, comment: a.comment! }))
        .reverse(),
      scores: chain.flatMap((e) => e.scores ?? []).sort((a, b) => a.session.date.localeCompare(b.session.date)),
      nextCourseName: last.class.course?.nextCourse?.name ?? null,
      homework: homeworkStats(attendances.map((a) => a.homework)),
    };
  });
  return runs.sort((a, b) => b.from.localeCompare(a.from) || b.key - a.key);
}

export function attendanceLine(s: AttendanceSummary): string {
  if (!s.held) return "Chưa có buổi nào được điểm danh";
  const parts = [`đi học ${s.present + s.late}/${s.held} buổi`];
  if (s.late) parts.push(`${s.late} buổi đi muộn`);
  const absent = s.excused + s.unexcused;
  if (absent) parts.push(`vắng ${absent} buổi${s.excused ? ` (${s.excused} có phép)` : ""}`);
  if (s.madeUp) parts.push(`đã học bù ${s.madeUp} buổi`);
  return `${parts.join(", ")} · chuyên cần ${s.rate}%`;
}

/** "Giữa khóa 12/10: Nghe 7, Nói 8, Đọc 6.5, Viết 7 – tổng 7.1". */
export function scoreLine(s: HistoryScore): string {
  const skills = SKILLS.filter((k) => s[k.key] != null).map((k) => `${k.label} ${s[k.key]}`);
  const head = `${testKindOption(s.kind)?.label ?? "Kiểm tra"} ${formatDateVN(s.session.date).slice(0, 5)}`;
  return `${head}: ${skills.length ? `${skills.join(", ")} – ` : ""}tổng ${s.total ?? "—"}`;
}

/** Tin nhắn ngắn gửi phụ huynh qua Zalo / SMS cho một khóa. */
export function parentMessage(
  student: { fullName: string; englishName?: string | null },
  run: CourseRun,
  outcomeLabel?: string,
  centerName?: string,
): string {
  const name = student.englishName ? `${student.fullName} (${student.englishName})` : student.fullName;
  const period = `${formatDateVN(run.from)} – ${run.to ? formatDateVN(run.to) : "nay"}`;
  const lines = [
    `Kính gửi phụ huynh em ${name},`,
    `${centerName ?? "Trung tâm"} gửi kết quả khóa ${run.courseName} (lớp ${run.enrollments.map((e) => e.class.code).join(" → ")}, ${period}):`,
    `- Chuyên cần: ${attendanceLine(run.summary)}.`,
  ];
  if (run.scores.length) lines.push(`- Điểm kiểm tra: ${run.scores.map(scoreLine).join("; ")}.`);
  if (outcomeLabel) lines.push(`- Kết quả: ${outcomeLabel}.`);
  if (run.last.finalComment) lines.push(`- Nhận xét của giáo viên: ${run.last.finalComment}`);
  else if (run.comments.length) lines.push(`- Nhận xét gần đây: ${run.comments.slice(0, 3).map((c) => c.comment).join("; ")}.`);
  lines.push("Trân trọng.");
  return lines.join("\n");
}

export type SkillAverage = { key: SkillKey | "total"; label: string; value: number | null; count: number };

/** E2: điểm trung bình từng kỹ năng và điểm tổng qua các bài kiểm tra của khóa (bỏ qua ô trống). */
export function skillAverages(scores: HistoryScore[]): SkillAverage[] {
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x != null);
    return { value: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null, count: v.length };
  };
  return [
    ...SKILLS.map((k) => ({ key: k.key, label: k.label, ...avg(scores.map((s) => s[k.key])) })),
    { key: "total" as const, label: "Tổng", ...avg(scores.map((s) => s.total)) },
  ];
}
