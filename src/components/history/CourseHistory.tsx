"use client";

import { CopyOutlined, EditOutlined, HistoryOutlined, PrinterOutlined } from "@/client/primer-icons";
import { App, Button, Card, Col, Collapse, Descriptions, Empty, List, Row, Space, Statistic, Tag } from "@/client/primer-compat";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { BalanceCell } from "@/components/attendance/parts";
import { CenterTag, StatusTag } from "@/components/ui";
import { CLASS_STATUSES, COURSE_OUTCOMES, optionOf } from "@/lib/constants";
import { formatDateVN } from "@/lib/dates";
import { SKILLS, testKindOption } from "@/lib/curriculum";
import { buildCourseHistory, parentMessage, type CourseRun, type HistoryEnrollment, type HistoryScore } from "@/lib/history";

type Props<E extends HistoryEnrollment> = {
  student: { id: number; fullName: string; englishName: string | null };
  enrollments: E[];
  /** Bảng điểm danh từng buổi của một lớp trong khóa. */
  renderDetail: (e: E) => ReactNode;
  /** Ghi được kết quả cuối khóa cho ghi danh này không. */
  canWrite: (e: E) => boolean;
  onOutcome: (e: E) => void;
};

export function OutcomeTag({ value }: { value: string | null }) {
  return value ? <StatusTag options={COURSE_OUTCOMES} value={value} /> : null;
}

/** Lịch sử học tập theo khóa (hồ sơ học sinh): mỗi khóa một thẻ, chuyên cần, nhận xét, kết quả; in hoặc chép tin nhắn gửi phụ huynh. */
export function CourseHistory<E extends HistoryEnrollment>({ student, enrollments, renderDetail, canWrite, onOutcome }: Props<E>) {
  const runs = useMemo(() => buildCourseHistory(enrollments), [enrollments]);
  if (runs.length === 0) return <Empty description="Chưa học khóa nào." />;
  return (
    <>
      <div className="filter-bar">
        <span className="sub">{runs.length} khóa. Chuyển lớp trong cùng khóa được gộp chung một thẻ.</span>
        <div className="spacer" />
        <Link href={`/students/${student.id}/report`}>
          <Button icon={<PrinterOutlined />}>In toàn bộ lịch sử</Button>
        </Link>
      </div>
      {runs.map((run) => (
        <RunCard key={run.key} run={run} student={student} renderDetail={renderDetail} canWrite={canWrite} onOutcome={onOutcome} />
      ))}
    </>
  );
}

function RunCard<E extends HistoryEnrollment>({
  run,
  student,
  renderDetail,
  canWrite,
  onOutcome,
}: { run: CourseRun<E> } & Omit<Props<E>, "enrollments">) {
  const { message } = App.useApp();
  const [allComments, setAllComments] = useState(false);
  const s = run.summary;
  const outcomeLabel = optionOf(COURSE_OUTCOMES, run.last.outcome)?.label;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(parentMessage(student, run, outcomeLabel, run.last.class.center.name));
      message.success("Đã chép tin nhắn, dán vào Zalo để gửi phụ huynh");
    } catch {
      message.error("Trình duyệt không cho chép, mở trang in để gửi");
    }
  };
  const comments = allComments ? run.comments : run.comments.slice(0, 4);
  return (
    <Card
      size="small"
      style={{ marginBottom: 16, borderLeft: `3px solid ${run.last.class.center.color}` }}
      title={
        <Space wrap size={[8, 4]}>
          <span style={{ fontSize: 16 }}>{run.courseName}</span>
          {run.ongoing ? <Tag color="green">Đang học</Tag> : <StatusTag options={CLASS_STATUSES} value={run.last.class.status === "CANCELLED" ? "CANCELLED" : "FINISHED"} />}
          <OutcomeTag value={run.last.outcome} />
        </Space>
      }
      extra={
        <Space wrap>
          {canWrite(run.last) && (
            <Button size="small" icon={<EditOutlined />} onClick={() => onOutcome(run.last)}>
              {run.last.outcome || run.last.finalComment ? "Sửa kết quả" : "Ghi kết quả"}
            </Button>
          )}
          <Link href={`/students/${student.id}/history?run=${run.key}`}>
            <Button size="small" type="primary" icon={<HistoryOutlined />}>
              Xem lịch sử học tập
            </Button>
          </Link>
          <Button size="small" icon={<CopyOutlined />} onClick={copy}>
            Chép tin nhắn
          </Button>
          <Link href={`/students/${student.id}/report?run=${run.key}`}>
            <Button size="small" icon={<PrinterOutlined />}>
              In
            </Button>
          </Link>
        </Space>
      }
    >
      <Row gutter={[16, 12]}>
        <Col xs={24} lg={12}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Lớp">
              <Space wrap size={4}>
                {run.enrollments.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && "→ "}
                    <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link> <span className="sub">{e.class.name}</span>
                  </span>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Trung tâm">
              <CenterTag center={run.last.class.center} />
            </Descriptions.Item>
            <Descriptions.Item label="Giáo viên">{run.teachers.join(", ")}</Descriptions.Item>
            <Descriptions.Item label="Thời gian">
              {formatDateVN(run.from)} – {run.to ? formatDateVN(run.to) : "nay"}
            </Descriptions.Item>
            {run.ongoing && (
              <Descriptions.Item label="Buổi còn lại">
                <BalanceCell balance={run.last.balance} warn />
              </Descriptions.Item>
            )}
          </Descriptions>
        </Col>
        <Col xs={24} lg={12}>
          <Row gutter={[8, 8]}>
            <Col span={8}>
              <Statistic title="Chuyên cần" value={s.rate ?? "—"} suffix={s.rate != null ? "%" : undefined} valueStyle={{ color: s.rate != null && s.rate < 80 ? "var(--fgColor-danger)" : "var(--fgColor-success)" }} />
            </Col>
            <Col span={8}>
              <Statistic title="Đi học" value={s.present + s.late} suffix={`/ ${s.held}`} />
            </Col>
            <Col span={8}>
              <Statistic title="Đi muộn" value={s.late} />
            </Col>
            <Col span={8}>
              <Statistic title="Vắng có phép" value={s.excused} />
            </Col>
            <Col span={8}>
              <Statistic title="Vắng không phép" value={s.unexcused} valueStyle={s.unexcused ? { color: "var(--fgColor-danger)" } : undefined} />
            </Col>
            <Col span={8}>
              <Statistic title="Đã học bù" value={s.madeUp} />
            </Col>
          </Row>
        </Col>
      </Row>
      {run.scores.length > 0 && <ScoreTable scores={run.scores} />}
      {!run.ongoing && run.nextCourseName && (
        <div className="sub" style={{ marginTop: 8 }}>
          Khóa tiếp theo gợi ý: <b>{run.nextCourseName}</b>
        </div>
      )}
      {(run.last.finalComment || run.last.outcome) && (
        <div className="final-comment">
          <div className="sub">
            Nhận xét cuối khóa{run.last.outcomeBy ? ` · ${run.last.outcomeBy}` : ""}
          </div>
          {outcomeLabel && <b>{outcomeLabel}. </b>}
          {run.last.finalComment}
        </div>
      )}
      {run.comments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="sub" style={{ marginBottom: 4 }}>
            Nhận xét theo buổi ({run.comments.length})
          </div>
          <List
            size="small"
            dataSource={comments}
            renderItem={(c) => (
              <List.Item style={{ padding: "4px 0" }}>
                <span>
                  <span className="sub">
                    {formatDateVN(c.date)} · {c.classCode}:
                  </span>{" "}
                  {c.comment}
                </span>
              </List.Item>
            )}
          />
          {run.comments.length > 4 && (
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setAllComments(!allComments)}>
              {allComments ? "Thu gọn" : `Xem cả ${run.comments.length} nhận xét`}
            </Button>
          )}
        </div>
      )}
      <Collapse
        ghost
        style={{ marginTop: 8 }}
        items={run.enrollments.map((e) => ({
          key: e.id,
          label: `Điểm danh từng buổi · ${e.class.code} (${e.attendances.length} buổi)`,
          children: renderDetail(e),
        }))}
      />
    </Card>
  );
}

/** Bảng điểm kiểm tra theo kỹ năng của một khóa (dùng cả ở trang in). */
export function ScoreTable({ scores, className = "score-table" }: { scores: HistoryScore[]; className?: string }) {
  return (
    <div style={{ marginTop: 12, overflowX: "auto" }}>
      <div className="sub" style={{ marginBottom: 4 }}>
        Điểm kiểm tra
      </div>
      <table className={className}>
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Bài kiểm tra</th>
            {SKILLS.map((k) => (
              <th key={k.key}>{k.label}</th>
            ))}
            <th>Tổng</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((x) => (
            <tr key={x.id}>
              <td>{formatDateVN(x.session.date)}</td>
              <td>
                {testKindOption(x.kind)?.label ?? x.kind} · {x.session.class.code}
              </td>
              {SKILLS.map((k) => (
                <td key={k.key}>{x[k.key] ?? ""}</td>
              ))}
              <td>
                <b>{x.total ?? ""}</b>
              </td>
              <td>{x.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
