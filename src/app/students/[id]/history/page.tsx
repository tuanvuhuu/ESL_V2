"use client";

import { ArrowLeftOutlined, CheckSquareOutlined, CopyOutlined, MessageOutlined, PrinterOutlined } from "@/client/primer-icons";
import { App, Button, Empty, Segmented, Select, Skeleton, Space, Tag } from "@/client/primer-compat";
import Link from "next/link";
import { usePathname, useRouter, useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useApi } from "@/client/api";
import type { Balance } from "@/client/types";
import { BalanceCell } from "@/components/attendance/parts";
import { TestKindTag } from "@/components/curriculum/LessonCard";
import { OutcomeTag, ScoreTable } from "@/components/history/CourseHistory";
import { CenterTag, PersonAvatar } from "@/components/ui";
import { attendanceOption } from "@/lib/attendance";
import { tint } from "@/lib/colors";
import { COURSE_OUTCOMES, optionOf } from "@/lib/constants";
import { homeworkOption, MAX_SCORE } from "@/lib/curriculum";
import { formatDateVN } from "@/lib/dates";
import { buildCourseHistory, parentMessage, scoreLine, skillAverages, type CourseRun, type HistoryAttendance, type HistoryEnrollment } from "@/lib/history";

type Attendance = HistoryAttendance & {
  homework: string | null;
  lesson: { title: string; testKind: string | null } | null;
  session: HistoryAttendance["session"] & { id: number; teacher: { displayName: string } };
};

type Enrollment = HistoryEnrollment & { attendances: Attendance[]; balance: Balance | null };

type Data = {
  id: number;
  code: string;
  fullName: string;
  englishName: string | null;
  status: string;
  center: { name: string; color: string };
  enrollments: Enrollment[];
};

/** E2: lịch sử học tập của một học sinh trong một khóa, đọc trên một trang: tổng quan, điểm theo kỹ năng, từng buổi. */
export default function LearningHistoryPage() {
  return (
    <Suspense fallback={<Skeleton active />}>
      <History />
    </Suspense>
  );
}

function History() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading, error } = useApi<Data>(`/api/students/${id}/history`);
  const runs = useMemo(() => buildCourseHistory(data?.enrollments ?? []), [data]);

  if (loading && !data) return <Skeleton active />;
  if (!data) return <Empty description={error?.message ?? "Không tìm thấy học sinh"} />;

  const wanted = Number(sp.get("run")) || null;
  const run = runs.find((r) => r.key === wanted) ?? runs[0] ?? null;
  const pick = (key: number) => router.replace(`${pathname}?run=${key}`);
  const runLabel = (r: CourseRun) => `${r.courseName}${r.ongoing ? " · đang học" : ""}`;

  return (
    <div className="hist-page">
      <Space wrap className="no-print" style={{ marginBottom: 12 }}>
        <Link href={`/students/${data.id}`}>
          <Button type="text" icon={<ArrowLeftOutlined />}>
            Về hồ sơ
          </Button>
        </Link>
      </Space>
      <div className="hist-hero" style={{ borderTopColor: data.center.color }}>
        <PersonAvatar name={data.fullName} color={data.center.color} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hist-title">
            {data.fullName}
            {data.englishName && <span className="sub"> · {data.englishName}</span>}
          </div>
          <Space wrap size={[8, 4]}>
            <span className="sub">{data.code}</span>
            <CenterTag center={data.center} />
            <span className="sub">{runs.length} khóa đã học</span>
          </Space>
        </div>
        {runs.length > 1 &&
          (runs.length <= 4 ? (
            <Segmented value={run?.key} onChange={(v) => pick(Number(v))} options={runs.map((r) => ({ value: r.key, label: runLabel(r) }))} />
          ) : (
            <Select style={{ minWidth: 240 }} value={run?.key} onChange={(v: number) => pick(v)} options={runs.map((r) => ({ value: r.key, label: runLabel(r) }))} />
          ))}
      </div>
      {run ? <RunView run={run as CourseRun<Enrollment>} student={data} /> : <Empty description="Học sinh chưa học khóa nào." />}
    </div>
  );
}

function RunView({ run, student }: { run: CourseRun<Enrollment>; student: Data }) {
  const { message } = App.useApp();
  const s = run.summary;
  const outcomeLabel = optionOf(COURSE_OUTCOMES, run.last.outcome)?.label;
  const averages = skillAverages(run.scores);
  const total = averages.find((a) => a.key === "total");
  const sessions = run.enrollments
    .flatMap((e) => e.attendances)
    .sort((a, b) => b.session.date.localeCompare(a.session.date) || b.session.startTime.localeCompare(a.session.startTime));
  const scoreBySession = new Map(run.scores.map((x) => [x.session.id, x]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(parentMessage(student, run, outcomeLabel, run.last.class.center.name));
      message.success("Đã chép tin nhắn, dán vào Zalo để gửi phụ huynh");
    } catch {
      message.error("Trình duyệt không cho chép, mở trang in để gửi");
    }
  };

  return (
    <>
      <div className="hist-course">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space wrap size={[8, 4]}>
            <span className="hist-course-name">{run.courseName}</span>
            {run.ongoing ? <Tag color="green">Đang học</Tag> : <Tag>{run.last.class.status === "CANCELLED" ? "Lớp đã hủy" : "Đã kết thúc"}</Tag>}
            <OutcomeTag value={run.last.outcome} />
          </Space>
          <div className="sub" style={{ marginTop: 4 }}>
            Lớp{" "}
            {run.enrollments.map((e, i) => (
              <span key={e.id}>
                {i > 0 && " → "}
                <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link>
              </span>
            ))}{" "}
            · {run.teachers.join(", ")} · {formatDateVN(run.from)} – {run.to ? formatDateVN(run.to) : "nay"}
          </div>
        </div>
        <Space wrap className="no-print">
          <Button icon={<CopyOutlined />} onClick={copy}>
            Chép tin nhắn Zalo
          </Button>
          <Link href={`/students/${student.id}/report?run=${run.key}`}>
            <Button icon={<PrinterOutlined />}>In / PDF</Button>
          </Link>
        </Space>
      </div>

      <div className="hist-kpis">
        <Kpi label="Chuyên cần" value={s.rate != null ? `${s.rate}%` : "—"} tone={s.rate == null ? undefined : s.rate < 80 ? "danger" : "success"} hint={`${s.present + s.late}/${s.held} buổi có mặt`} />
        <Kpi
          label="Vắng"
          value={String(s.excused + s.unexcused)}
          tone={s.unexcused ? "danger" : undefined}
          hint={s.excused + s.unexcused ? `${s.excused} có phép · ${s.unexcused} không phép${s.madeUp ? ` · bù ${s.madeUp}` : ""}` : "Không vắng buổi nào"}
        />
        <Kpi
          label="Bài tập"
          value={run.homework.rate != null ? `${run.homework.rate}%` : "—"}
          tone={run.homework.rate == null ? undefined : run.homework.rate < 70 ? "attention" : "success"}
          hint={run.homework.checked ? `${run.homework.done} đã làm · ${run.homework.partial} chưa đủ · ${run.homework.missing} không làm` : "Chưa chấm bài tập"}
        />
        <Kpi label="Điểm trung bình" value={total?.value != null ? String(total.value) : "—"} hint={run.scores.length ? `${run.scores.length} bài kiểm tra` : "Chưa có điểm"} />
        {run.ongoing && (
          <div className="hist-kpi">
            <div className="sub">Buổi còn lại</div>
            <BalanceCell balance={run.last.balance} warn />
          </div>
        )}
      </div>

      {(run.scores.length > 0 || run.last.finalComment || run.last.outcome || (!run.ongoing && run.nextCourseName)) && (
        <div className="hist-grid">
          {run.scores.length > 0 && (
            <section className="hist-card">
              <h3>Điểm theo kỹ năng</h3>
              {averages.map((a) => (
                <div key={a.key} className="skill-row">
                  <span className={a.key === "total" ? "skill-label strong" : "skill-label"}>{a.label}</span>
                  <span className="skill-track">
                    <span className="skill-fill" style={{ width: `${((a.value ?? 0) / MAX_SCORE) * 100}%` }} />
                  </span>
                  <span className="skill-value">{a.value ?? "—"}</span>
                </div>
              ))}
              <ScoreTable scores={run.scores} />
            </section>
          )}
          {(run.last.finalComment || run.last.outcome || (!run.ongoing && run.nextCourseName)) && (
            <section className="hist-card">
              <h3>Kết quả cuối khóa</h3>
              {outcomeLabel ? <b>{outcomeLabel}</b> : <span className="sub">Chưa ghi kết quả</span>}
              {run.last.finalComment && <p className="hist-quote">{run.last.finalComment}</p>}
              {run.last.outcomeBy && <div className="sub">Ghi bởi {run.last.outcomeBy}</div>}
              {!run.ongoing && run.nextCourseName && (
                <div style={{ marginTop: 8 }}>
                  Khóa tiếp theo gợi ý: <b>{run.nextCourseName}</b>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <section className="hist-card">
        <h3>Từng buổi học ({sessions.length})</h3>
        {sessions.length === 0 && <Empty description="Chưa có buổi nào được điểm danh." />}
        <ol className="hist-timeline">
          {sessions.map((a) => {
            const att = attendanceOption(a.status);
            const hw = homeworkOption(a.homework);
            const score = scoreBySession.get(a.session.id);
            return (
              <li key={a.id} className="hist-item">
                <span className="hist-dot" style={{ background: att?.color }} />
                <div className="hist-item-when">
                  <b>{formatDateVN(a.session.date).slice(0, 5)}</b>
                  <span className="sub">Buổi {a.session.index}</span>
                </div>
                <div className="hist-item-body">
                  <Space wrap size={[6, 2]}>
                    <b>{a.lesson?.title ?? a.session.lessonContent ?? "Buổi học"}</b>
                    <TestKindTag value={a.lesson?.testKind} />
                    {a.makeupId && <Tag color="purple">Học bù ở {a.session.class.code}</Tag>}
                  </Space>
                  {a.lesson && a.session.lessonContent && a.session.lessonContent !== a.lesson.title && <div className="sub">Đã dạy: {a.session.lessonContent}</div>}
                  <div className="hist-item-tags">
                    {att && (
                      <span className="hist-pill" style={{ color: att.color, background: tint(att.color, 8) }}>
                        {att.label}
                      </span>
                    )}
                    {hw && (
                      <span className="hist-pill" style={{ color: hw.color, background: tint(hw.color, 8) }}>
                        <CheckSquareOutlined /> Bài tập: {hw.short.toLowerCase()}
                      </span>
                    )}
                    {score && <span className="hist-pill score">{scoreLine(score)}</span>}
                  </div>
                  {a.comment && (
                    <div className="hist-comment">
                      <MessageOutlined /> {a.comment} <span className="sub">· {a.session.teacher.displayName}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "danger" | "attention" }) {
  return (
    <div className="hist-kpi">
      <div className="sub">{label}</div>
      <div className="hist-kpi-value" style={tone ? { color: `var(--fgColor-${tone})` } : undefined}>
        {value}
      </div>
      {hint && <div className="sub">{hint}</div>}
    </div>
  );
}
