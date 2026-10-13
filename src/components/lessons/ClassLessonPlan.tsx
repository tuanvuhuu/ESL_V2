"use client";

import { CheckSquareOutlined, LinkOutlined } from "@/client/primer-icons";
import { Button, Empty, Skeleton, Space, Tag } from "@/client/primer-compat";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/client/api";
import { TestKindTag, type Lesson } from "@/components/curriculum/LessonCard";
import { CenterTag } from "@/components/ui";
import { HOMEWORK_STATUSES, type HomeworkStats } from "@/lib/curriculum";
import { formatDateVN, todayISO } from "@/lib/dates";

export type PlanSession = {
  id: number;
  index: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  lessonContent: string | null;
  homework: string | null;
  attendanceTakenAt: string | null;
  teacher: { displayName: string };
  lesson: Lesson | null;
  assignedHomework: string | null;
  present: number;
  roster: number;
  homeworkChecked: HomeworkStats;
};

export type Plan = {
  class: {
    id: number;
    code: string;
    name: string;
    status: string;
    course: { id: number; name: string; totalSessions: number } | null;
    center: { id: number; name: string; color: string };
    teacher: { displayName: string };
  };
  lessonCount: number;
  sessions: PlanSession[];
};

/** Ba ô đếm kết quả chấm bài tập: đã làm / chưa đủ / không làm. */
export function HomeworkCounts({ stats }: { stats: HomeworkStats }) {
  if (!stats.checked) return null;
  const n = { DONE: stats.done, PARTIAL: stats.partial, MISSING: stats.missing } as const;
  return (
    <Space size={4} wrap>
      {HOMEWORK_STATUSES.filter((o) => n[o.value]).map((o) => (
        <Tag key={o.value} color={o.color}>
          {n[o.value]} {o.short.toLowerCase()}
        </Tag>
      ))}
    </Space>
  );
}

/** Bài giảng và bài tập từng buổi của một lớp (E1): buổi tới được làm nổi, buổi đã dạy có nội dung và kết quả bài tập. */
export function ClassLessonPlan({ classId }: { classId: number }) {
  const { data, loading, error } = useApi<Plan>(`/api/classes/${classId}/lessons`);
  const [openId, setOpenId] = useState<number | null>(null);
  if (loading && !data) return <Skeleton active />;
  if (!data) return <Empty description={error?.message ?? "Không tải được lớp"} />;

  const today = todayISO();
  const next = data.sessions.find((s) => s.status !== "CANCELLED" && s.date >= today);
  const taught = data.sessions.filter((s) => s.attendanceTakenAt).length;
  const course = data.class.course;

  return (
    <>
      <div className="lesson-plan-head">
        <Space wrap size={[8, 4]}>
          <b>{data.class.code}</b>
          <span>{data.class.name}</span>
          <CenterTag center={data.class.center} />
        </Space>
        <div className="sub">
          {course ? `Khóa ${course.name} · ${data.lessonCount}/${course.totalSessions} buổi có bài trong khung` : "Lớp chưa gắn khóa học nên chưa có khung bài giảng"} · đã dạy{" "}
          {taught}/{data.sessions.filter((s) => s.status !== "CANCELLED").length} buổi · {data.class.teacher.displayName}
        </div>
      </div>
      {data.sessions.length === 0 && <Empty description="Lớp chưa có buổi học nào." />}
      <ol className="lesson-plan">
        {data.sessions.map((s) => {
          const cancelled = s.status === "CANCELLED";
          const isNext = s.id === next?.id;
          const open = openId === s.id || (openId === null && isNext);
          const l = s.lesson;
          const hasDetail = !!(l && (l.objectives || l.content || l.materials.length));
          return (
            <li key={s.id} className={`lesson-row${isNext ? " is-next" : ""}${cancelled ? " is-cancelled" : ""}${s.attendanceTakenAt ? " is-done" : ""}`}>
              <div className="lesson-when">
                <b>Buổi {s.index}</b>
                <span className="sub">{formatDateVN(s.date).slice(0, 5)}</span>
                <span className="sub">{s.startTime}</span>
              </div>
              <div className="lesson-body">
                <Space wrap size={[6, 2]}>
                  <b>{l?.title ?? <span className="sub">Chưa có bài trong khung</span>}</b>
                  <TestKindTag value={l?.testKind} />
                  {isNext && <Tag color="blue">Buổi tới</Tag>}
                  {cancelled && <Tag color="red">Đã hủy</Tag>}
                  {s.attendanceTakenAt && <Tag color="green">Đã dạy</Tag>}
                </Space>
                {s.lessonContent && <div className="lesson-line">Đã dạy: {s.lessonContent}</div>}
                {s.assignedHomework && (
                  <div className="lesson-line">
                    <CheckSquareOutlined /> Bài tập về nhà: {s.assignedHomework}
                    {s.homework && l?.homework && s.homework !== l.homework && <span className="sub"> (giáo viên giao khác khung)</span>}
                  </div>
                )}
                {s.homeworkChecked.checked > 0 && (
                  <div className="lesson-line">
                    <span className="sub">Chấm bài tập buổi trước: </span>
                    <HomeworkCounts stats={s.homeworkChecked} />
                  </div>
                )}
                {open && hasDetail && (
                  <div className="lesson-detail">
                    {l!.objectives && (
                      <div>
                        <div className="sub">Mục tiêu</div>
                        <div className="pre">{l!.objectives}</div>
                      </div>
                    )}
                    {l!.content && (
                      <div>
                        <div className="sub">Nội dung</div>
                        <div className="pre">{l!.content}</div>
                      </div>
                    )}
                    {l!.materials.length > 0 && (
                      <div>
                        <div className="sub">Tài liệu</div>
                        {l!.materials.map((m, i) => (
                          <div key={i}>
                            <a href={m.url} target="_blank" rel="noopener noreferrer">
                              <LinkOutlined /> {m.name}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="lesson-actions">
                {hasDetail && (
                  <Button size="small" type="link" onClick={() => setOpenId(open ? -1 : s.id)}>
                    {open ? "Thu gọn" : "Chi tiết"}
                  </Button>
                )}
                {!cancelled && (
                  <Link href={`/sessions/${s.id}`}>
                    <Button size="small">{s.attendanceTakenAt ? "Xem buổi" : "Điểm danh"}</Button>
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
