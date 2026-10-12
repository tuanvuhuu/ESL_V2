"use client";

import { ArrowLeftOutlined, CopyOutlined, PrinterOutlined } from "@/client/primer-icons";
import { App, Button, Empty, Skeleton, Space } from "@/client/primer-compat";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useApi } from "@/client/api";
import { attendanceOption } from "@/lib/attendance";
import { COURSE_OUTCOMES, optionOf } from "@/lib/constants";
import { ageFrom, formatDateVN, todayISO } from "@/lib/dates";
import { attendanceLine, buildCourseHistory, parentMessage, type HistoryEnrollment } from "@/lib/history";

type Detail = {
  id: number;
  code: string;
  fullName: string;
  englishName: string | null;
  dob: string;
  center: { name: string; address: string | null };
  enrollments: HistoryEnrollment[];
};

/** Trang in lịch sử học tập theo khóa gửi phụ huynh: in giấy hoặc lưu PDF; `?run=` in riêng một khóa. */
export default function StudentReportPage() {
  return (
    <Suspense fallback={<Skeleton active />}>
      <Report />
    </Suspense>
  );
}

function Report() {
  const { id } = useParams<{ id: string }>();
  const run = Number(useSearchParams().get("run")) || null;
  const { message } = App.useApp();
  const { data: s, loading } = useApi<Detail>(`/api/students/${id}`);
  const runs = useMemo(() => {
    const all = buildCourseHistory(s?.enrollments ?? []);
    return run ? all.filter((r) => r.key === run) : all;
  }, [s, run]);

  if (loading && !s) return <Skeleton active />;
  if (!s) return <Empty description="Không tìm thấy học sinh" />;

  const copy = async () => {
    const text = runs.map((r) => parentMessage(s, r, optionOf(COURSE_OUTCOMES, r.last.outcome)?.label, r.last.class.center.name)).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      message.success("Đã chép tin nhắn, dán vào Zalo để gửi phụ huynh");
    } catch {
      message.error("Trình duyệt không cho chép");
    }
  };

  return (
    <>
      <Space className="no-print" style={{ marginBottom: 16 }} wrap>
        <Link href={`/students/${s.id}`}>
          <Button icon={<ArrowLeftOutlined />}>Về hồ sơ</Button>
        </Link>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          In / lưu PDF
        </Button>
        <Button icon={<CopyOutlined />} onClick={copy} disabled={runs.length === 0}>
          Chép tin nhắn Zalo
        </Button>
        {run && <Link href={`/students/${s.id}/report`}>Xem tất cả các khóa</Link>}
      </Space>
      <div className="report-sheet">
        <div className="sub">
          {s.center.name}
          {s.center.address ? ` · ${s.center.address}` : ""}
        </div>
        <h1>Lịch sử học tập</h1>
        <div>
          Học sinh: <b>{s.fullName}</b>
          {s.englishName ? ` (${s.englishName})` : ""} · Mã {s.code} · {ageFrom(s.dob)} tuổi
        </div>
        <div className="sub">Ngày in: {formatDateVN(todayISO())}</div>
        {runs.length === 0 && <p>Chưa có khóa học nào.</p>}
        {runs.map((r) => {
          const outcome = optionOf(COURSE_OUTCOMES, r.last.outcome)?.label;
          const sessions = r.enrollments
            .flatMap((e) => e.attendances)
            .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.session.startTime.localeCompare(b.session.startTime));
          return (
            <section key={r.key} className="report-course">
              <h2>
                Khóa {r.courseName} {r.ongoing ? "(đang học)" : ""}
              </h2>
              <div>
                Lớp {r.enrollments.map((e) => e.class.code).join(" → ")} · Giáo viên {r.teachers.join(", ")} · {formatDateVN(r.from)} – {r.to ? formatDateVN(r.to) : "nay"}
              </div>
              <div>Chuyên cần: {attendanceLine(r.summary)}.</div>
              {outcome && (
                <div>
                  Kết quả: <b>{outcome}</b>
                </div>
              )}
              {r.last.finalComment && (
                <div className="final-comment">
                  <div className="sub">Nhận xét của giáo viên</div>
                  {r.last.finalComment}
                </div>
              )}
              {sessions.length > 0 && (
                <table className="report-table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Ngày</th>
                      <th style={{ width: 110 }}>Điểm danh</th>
                      <th>Nội dung bài học</th>
                      <th>Nhận xét</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((a) => (
                      <tr key={a.id}>
                        <td>{formatDateVN(a.session.date)}</td>
                        <td>
                          {attendanceOption(a.status)?.label}
                          {a.makeupId ? ` (học bù ở ${a.session.class.code})` : ""}
                        </td>
                        <td>{a.session.lessonContent ?? ""}</td>
                        <td>{a.comment ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
