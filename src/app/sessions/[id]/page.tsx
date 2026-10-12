"use client";

import { CheckOutlined, LeftOutlined, MessageOutlined } from "@ant-design/icons";
import { Alert, App, Button, Empty, Input, Skeleton, Space, Tag } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, useApi } from "@/client/api";
import { useViewer } from "@/client/session";
import type { Balance } from "@/client/types";
import { BalanceCell, MakeupTag } from "@/components/attendance/parts";
import { CenterTag, PersonAvatar } from "@/components/ui";
import { ATTENDANCE_STATUSES, attendanceOption, nextAttendanceStatus, type AttendanceStatus } from "@/lib/attendance";
import { formatDateVN } from "@/lib/dates";
import { isStaff } from "@/lib/permissions";

type Row = {
  studentId: number;
  enrollmentId: number;
  code: string;
  fullName: string;
  englishName: string | null;
  centerColor: string;
  makeup: { id: number; fromClassCode: string; fromDate: string } | null;
  status: string | null;
  comment: string | null;
  balance: Balance | null;
};

type Data = {
  session: {
    id: number;
    index: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    lessonContent: string | null;
    attendanceTakenAt: string | null;
    attendanceBy: string | null;
    teacherId: number;
    room: { name: string };
    teacher: { id: number; displayName: string };
    class: { id: number; code: string; name: string; teacherId: number; center: { id: number; name: string; color: string } };
  };
  roster: Row[];
  role: "teacher" | "assistant" | null;
  canEdit: boolean;
};

const QUICK_COMMENTS = ["Tích cực phát biểu", "Làm bài tốt", "Chưa làm bài tập", "Mất tập trung", "Cần ôn lại bài"];

type Draft = { status: AttendanceStatus; comment: string };

/** Điểm danh một buổi (G2): mặc định có mặt, chạm để đổi trạng thái, nút Lưu cố định cuối màn hình. */
export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const viewer = useViewer();
  const { message } = App.useApp();
  const { data, loading, error, reload } = useApi<Data>(`/api/sessions/${id}/attendance`);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [lesson, setLesson] = useState("");
  const [openComment, setOpenComment] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDrafts(
      Object.fromEntries(
        data.roster.map((r) => [r.studentId, { status: (r.status ?? "PRESENT") as AttendanceStatus, comment: r.comment ?? "" }]),
      ),
    );
    setLesson(data.session.lessonContent ?? "");
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of Object.values(drafts)) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [drafts]);

  if (loading && !data) return <Skeleton active />;
  if (!data) return <Empty description={error?.message ?? "Không tìm thấy buổi học"} />;

  const { session: s, roster, canEdit } = data;
  const taken = !!s.attendanceTakenAt;
  const dirty =
    !taken ||
    lesson !== (s.lessonContent ?? "") ||
    roster.some((r) => drafts[r.studentId] && (drafts[r.studentId].status !== r.status || drafts[r.studentId].comment !== (r.comment ?? "")));

  const set = (studentId: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [studentId]: { ...d[studentId], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/sessions/${s.id}/attendance`, {
        method: "PUT",
        body: {
          lessonContent: lesson,
          items: roster.map((r) => ({ studentId: r.studentId, status: drafts[r.studentId].status, comment: drafts[r.studentId].comment })),
        },
      });
      message.success(taken ? "Đã cập nhật điểm danh" : "Đã lưu điểm danh");
      setOpenComment(null);
      await reload();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const backHref = isStaff(viewer) ? "/" : `/classes/${s.class.id}`;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Button type="text" icon={<LeftOutlined />} onClick={() => (window.history.length > 1 ? router.back() : router.push(backHref))} style={{ marginLeft: -8 }}>
        Quay lại
      </Button>
      <div className="panel" style={{ marginBottom: 12, borderTop: `3px solid ${s.class.center.color}` }}>
        <Space wrap size={[8, 4]}>
          <b style={{ fontSize: 18 }}>
            {s.startTime}–{s.endTime}
          </b>
          <Link href={`/classes/${s.class.id}`}>
            <b>{s.class.code}</b>
          </Link>
          <span className="sub">{s.class.name}</span>
        </Space>
        <div className="sub" style={{ marginTop: 4 }}>
          {formatDateVN(s.date, true)} · Buổi {s.index} · Phòng {s.room.name} · {s.teacher.displayName}
          {s.teacherId !== s.class.teacherId && " (dạy thay)"}
        </div>
        <Space wrap style={{ marginTop: 8 }}>
          <CenterTag center={s.class.center} />
          {data.role === "teacher" && <Tag color="blue">Bạn dạy chính</Tag>}
          {data.role === "assistant" && <Tag color="purple">Bạn trợ giảng</Tag>}
          {taken ? (
            <Tag color="green" icon={<CheckOutlined />}>
              Đã điểm danh {dayjs(s.attendanceTakenAt).format("HH:mm DD/MM")}
              {s.attendanceBy ? ` · ${s.attendanceBy}` : ""}
            </Tag>
          ) : (
            <Tag color="orange">Chưa điểm danh</Tag>
          )}
        </Space>
      </div>

      {s.status === "CANCELLED" && <Alert type="error" showIcon message="Buổi này đã hủy, không điểm danh." style={{ marginBottom: 12 }} />}
      {s.status !== "CANCELLED" && !canEdit && s.date > dayjs().format("YYYY-MM-DD") && (
        <Alert type="info" showIcon message="Chưa đến ngày học. Danh sách dưới đây để xem trước." style={{ marginBottom: 12 }} />
      )}

      {roster.length === 0 ? (
        <Empty description="Buổi này chưa có học sinh nào." />
      ) : (
        <>
          <div className="sub" style={{ marginBottom: 8 }}>
            {roster.length} học sinh ·{" "}
            {ATTENDANCE_STATUSES.filter((o) => counts[o.value])
              .map((o) => `${counts[o.value]} ${o.short.toLowerCase()}`)
              .join(" · ")}
            {canEdit && " · Chạm vào học sinh để đổi trạng thái"}
          </div>
          <div className="att-list">
            {roster.map((r) => {
              const d = drafts[r.studentId];
              if (!d) return null;
              const o = attendanceOption(d.status)!;
              const out = r.balance && r.balance.remaining <= 0;
              return (
                <div key={r.studentId} className="att-row" style={{ borderLeftColor: o.color }}>
                  <div
                    className={`att-main${canEdit ? "" : " readonly"}`}
                    role={canEdit ? "button" : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onClick={() => canEdit && set(r.studentId, { status: nextAttendanceStatus(d.status) })}
                    onKeyDown={(e) => {
                      if (canEdit && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        set(r.studentId, { status: nextAttendanceStatus(d.status) });
                      }
                    }}
                  >
                    <PersonAvatar name={r.fullName} color={r.centerColor} />
                    <div className="att-name">
                      <b>{r.fullName}</b>
                      <span className="sub">
                        {r.englishName ? `${r.englishName} · ` : ""}
                        {r.code}
                      </span>
                      <div>
                        {r.makeup && <MakeupTag>Học bù · {r.makeup.fromClassCode} {formatDateVN(r.makeup.fromDate).slice(0, 5)}</MakeupTag>}
                        {out && <Tag color="red">Hết buổi</Tag>}
                      </div>
                    </div>
                    <span className="att-status" style={{ color: o.color, background: `${o.color}12` }}>
                      {o.short}
                    </span>
                  </div>
                  <div className="att-extra">
                    {openComment === r.studentId ? (
                      <>
                        <Input.TextArea
                          autoFocus
                          autoSize={{ minRows: 1, maxRows: 3 }}
                          maxLength={200}
                          placeholder="Nhận xét ngắn"
                          value={d.comment}
                          onChange={(e) => set(r.studentId, { comment: e.target.value })}
                        />
                        <div className="quick-comments">
                          {QUICK_COMMENTS.map((q) => (
                            <Tag.CheckableTag key={q} checked={d.comment === q} onChange={() => set(r.studentId, { comment: q })}>
                              {q}
                            </Tag.CheckableTag>
                          ))}
                        </div>
                      </>
                    ) : d.comment ? (
                      <span className="sub" onClick={() => canEdit && setOpenComment(r.studentId)} style={{ cursor: canEdit ? "pointer" : undefined }}>
                        <MessageOutlined /> {d.comment}
                      </span>
                    ) : (
                      canEdit && (
                        <Button size="small" type="link" icon={<MessageOutlined />} style={{ padding: 0 }} onClick={() => setOpenComment(r.studentId)}>
                          Nhận xét
                        </Button>
                      )
                    )}
                    <div className="sub" style={{ marginTop: 4 }}>
                      Còn lại: <BalanceCell balance={r.balance} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nội dung đã dạy</div>
            <Input
              placeholder="VD: Unit 5 – Animals, từ vựng + bài 1–3"
              maxLength={300}
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              disabled={!canEdit}
              size="large"
            />
          </div>
          {canEdit && (
            <div className="save-bar">
              <span className="sub" style={{ flex: 1 }}>
                {counts.PRESENT ?? 0}/{roster.length} có mặt
              </span>
              <Button type="primary" size="large" icon={<CheckOutlined />} loading={saving} disabled={!dirty} onClick={save} style={{ minWidth: 160 }}>
                {taken ? "Lưu thay đổi" : "Lưu điểm danh"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
