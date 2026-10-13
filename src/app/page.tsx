"use client";

import { CalendarOutlined, CheckSquareOutlined, StopOutlined, SwapOutlined } from "@/client/primer-icons";
import { Badge, Button, Col, Empty, List, Row, Statistic, Tabs, Tag } from "@/client/primer-compat";
import Link from "next/link";
import { useState } from "react";
import { qs, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import type { Balance, ScheduleSession } from "@/client/types";
import { BalanceCell } from "@/components/attendance/parts";
import { OutcomeTag } from "@/components/history/CourseHistory";
import { MySessionCard } from "@/components/my/SessionCard";
import { SubstituteModal, type SubstituteTarget } from "@/components/staffing/SubstituteModal";
import { PageHeader } from "@/components/ui";
import { addDays, formatDateVN, todayISO } from "@/lib/dates";
import { canEditCenter, isStaff } from "@/lib/permissions";
import { tint } from "@/lib/colors";

export default function TodayPage() {
  const viewer = useViewer();
  return isStaff(viewer) ? <StaffToday /> : <OfficeToday />;
}

/** Giờ hiện tại "HH:mm" theo giờ Việt Nam. */
const nowVN = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);

/** Hôm nay của giáo viên, trợ giảng (G1): thẻ từng buổi, nút Điểm danh; buổi tuần qua còn quên điểm danh. */
function StaffToday() {
  const viewer = useViewer();
  const today = todayISO();
  const { data, loading } = useApi<ScheduleSession[]>(`/api/schedule${qs({ from: addDays(today, -7), to: today })}`);
  const sessions = data ?? [];
  const todays = sessions.filter((s) => s.date === today);
  const missed = sessions.filter((s) => s.date < today && s.status !== "CANCELLED" && !s.attendanceTakenAt);
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader title={`Chào ${viewer.fullName.split(" ").pop()}`} description={`${formatDateVN(today, true)} · ${todays.filter((s) => s.status !== "CANCELLED").length} buổi hôm nay`} />
      {!loading && todays.length === 0 && <Empty description="Hôm nay bạn không có buổi dạy nào." />}
      {todays.map((s) => (
        <MySessionCard key={s.id} s={s} teacherId={viewer.teacherId!} />
      ))}
      {missed.length > 0 && (
        <>
          <div className="day-label" style={{ color: "var(--fgColor-attention)" }}>
            Buổi trước chưa điểm danh ({missed.length})
          </div>
          {missed.map((s) => (
            <div key={s.id}>
              <div className="sub">{formatDateVN(s.date, true)}</div>
              <MySessionCard s={s} teacherId={viewer.teacherId!} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

type Attention = {
  lowBalance: { enrollmentId: number; student: StudentLite; class: { id: number; code: string }; balance: Balance }[];
  exhausted: { enrollmentId: number; student: StudentLite; class: { id: number; code: string }; balance: Balance }[];
  frequentAbsences: { student: StudentLite; count: number }[];
  notTaken: (ScheduleSession & { teacher: { displayName: string } })[];
  notTakenCount: number;
  pendingMakeups: number;
  needSubstitute: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    leaveReason: string;
    teacher: { displayName: string };
    class: { id: number; code: string; centerId: number; center: { name: string; color: string } };
  }[];
  reservationsDue: { id: number; expectedReturn: string; startDate: string; student: StudentLite }[];
  followUpsDue: number;
  toAdvise: { enrollmentId: number; student: StudentLite; class: { id: number; code: string; course: { name: string } | null }; outcome: string | null }[];
};
type StudentLite = { id: number; code: string; fullName: string; center: { name: string; color: string } };

function TabLabel({ text, count, color }: { text: string; count: number; color?: string }) {
  return (
    <span>
      {text} <Badge count={count} color={color} size="small" style={{ marginInlineStart: 4 }} />
    </span>
  );
}

/** Tổng quan hôm nay của quản lý, giáo vụ (M2, DESIGN 6.4). */
function OfficeToday() {
  const today = todayISO();
  const { centers, centerId } = useCenters();
  const { data } = useApi<ScheduleSession[]>(`/api/schedule${qs({ from: today, to: today, centerId })}`);
  const { data: att, reload: reloadAttention } = useApi<Attention>(`/api/attention${qs({ centerId })}`);
  const [sub, setSub] = useState<SubstituteTarget | null>(null);
  const viewer = useViewer();
  const shown = centerId ? centers.filter((c) => c.id === centerId) : centers;
  const sessions = data ?? [];
  const active = sessions.filter((s) => s.status !== "CANCELLED");
  const cancelled = sessions.length - active.length;
  const now = nowVN();
  const notTakenToday = active.filter((s) => !s.attendanceTakenAt && s.endTime <= now).length;
  const stats = [
    { title: "Buổi học hôm nay", value: active.length, icon: <CalendarOutlined />, color: "var(--fgColor-accent)" },
    { title: "Chưa điểm danh", value: notTakenToday, icon: <CheckSquareOutlined />, color: "var(--fgColor-attention)", alert: notTakenToday > 0 },
    { title: "Buổi bị hủy", value: cancelled, icon: <StopOutlined />, color: "var(--fgColor-danger)", alert: cancelled > 0 },
    { title: "Dạy thay", value: active.filter((s) => s.teacherId !== s.class.teacherId).length, icon: <SwapOutlined />, color: "var(--fgColor-done)" },
  ];

  const studentLink = (s: StudentLite) => (
    <>
      <Link href={`/students/${s.id}`}>{s.fullName}</Link> <span className="sub">{s.code}</span>
    </>
  );

  return (
    <>
      <PageHeader title="Hôm nay" description={formatDateVN(today, true)} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {stats.map((st) => (
          <Col key={st.title} xs={12} md={6}>
            <div className="panel stat-card">
              <span className="stat-icon" style={{ color: st.color, background: tint(st.color, 8) }}>
                {st.icon}
              </span>
              <Statistic title={st.title} value={st.value} valueStyle={st.alert ? { color: st.color } : undefined} />
            </div>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        {shown.map((c) => {
          const items = sessions.filter((s) => s.class.center.id === c.id);
          return (
            <Col key={c.id} xs={24} md={12} xl={24 / Math.max(1, Math.min(4, shown.length))} className="today-col">
              <div className="panel" style={{ borderTop: `3px solid ${c.color}` }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: c.color }}>
                  {c.name} <span className="sub">· {items.length} buổi</span>
                </div>
                {items.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có buổi học." />}
                {items.map((s) => (
                  <div key={s.id} className="session-item" style={{ borderLeftColor: c.color, textDecoration: s.status === "CANCELLED" ? "line-through" : undefined }}>
                    <b className="num">
                      {s.startTime}–{s.endTime}
                    </b>{" "}
                    <Link href={`/classes/${s.class.id}`}>{s.class.code}</Link> <span className="sub">{s.class.name}</span>
                    <div className="sub">
                      Phòng {s.room.name} · {s.teacher.displayName}
                      {s.class.assistants.length ? ` + ${s.class.assistants.map((a) => a.teacher.displayName).join(", ")}` : ""} ·{" "}
                      {s.class._count.enrollments} HS
                      {s._count?.makeups ? ` + ${s._count.makeups} học bù` : ""}
                    </div>
                    {s.status === "CANCELLED" && <Tag color="red">Đã hủy</Tag>}
                    {s.status !== "CANCELLED" && s.teacherId !== s.class.teacherId && <Tag color="purple">Dạy thay</Tag>}
                    {s.status !== "CANCELLED" &&
                      (s.attendanceTakenAt ? (
                        <Link href={`/sessions/${s.id}`}>
                          <Tag color="green">Đã điểm danh</Tag>
                        </Link>
                      ) : s.endTime <= now ? (
                        <Link href={`/sessions/${s.id}`}>
                          <Tag color="orange">Chưa điểm danh</Tag>
                        </Link>
                      ) : null)}
                  </div>
                ))}
              </div>
            </Col>
          );
        })}
      </Row>
      {att && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Cần chú ý</div>
          <Tabs
            items={[
              {
                key: "low",
                label: <TabLabel text="Sắp hết buổi" count={att.lowBalance.length} color="var(--fgColor-attention)" />,
                children: (
                  <List
                    size="small"
                    locale={{ emptyText: "Không có học sinh nào còn ≤ 3 buổi." }}
                    dataSource={att.lowBalance}
                    renderItem={(e) => (
                      <List.Item extra={<BalanceCell balance={e.balance} />}>
                        <span>
                          {studentLink(e.student)} · <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link>
                        </span>
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "out",
                label: <TabLabel text="Hết buổi vẫn đi học" count={att.exhausted.length} />,
                children: (
                  <List
                    size="small"
                    locale={{ emptyText: "Không có." }}
                    dataSource={att.exhausted}
                    renderItem={(e) => (
                      <List.Item extra={<BalanceCell balance={e.balance} />}>
                        <span>
                          {studentLink(e.student)} · <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link>
                        </span>
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "absent",
                label: <TabLabel text="Vắng nhiều" count={att.frequentAbsences.length} color="var(--fgColor-attention)" />,
                children: (
                  <List
                    size="small"
                    locale={{ emptyText: "Không có học sinh nào vắng từ 3 buổi trong 30 ngày qua." }}
                    dataSource={att.frequentAbsences}
                    renderItem={(x) => (
                      <List.Item extra={<Tag color="red">Vắng {x.count} buổi / 30 ngày</Tag>}>{studentLink(x.student)}</List.Item>
                    )}
                  />
                ),
              },
              {
                key: "nottaken",
                label: <TabLabel text="Chưa điểm danh" count={att.notTakenCount} color="var(--fgColor-attention)" />,
                children: (
                  <List
                    size="small"
                    locale={{ emptyText: "Mọi buổi 14 ngày qua đã điểm danh." }}
                    dataSource={att.notTaken}
                    renderItem={(s) => (
                      <List.Item extra={<Link href={`/sessions/${s.id}`}>Điểm danh</Link>}>
                        <span>
                          <b>{formatDateVN(s.date, true)}</b> {s.startTime} · <Link href={`/classes/${s.class.id}`}>{s.class.code}</Link> ·{" "}
                          {s.teacher.displayName}
                        </span>
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "substitute",
                label: <TabLabel text="Cần người dạy thay" count={att.needSubstitute.length} color="var(--fgColor-danger)" />,
                children: (
                  <List
                    size="small"
                    locale={{ emptyText: "14 ngày tới không có buổi nào của người đang nghỉ." }}
                    dataSource={att.needSubstitute}
                    renderItem={(s) => (
                      <List.Item
                        extra={
                          canEditCenter(viewer, s.class.centerId) && (
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => setSub({ id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, classCode: s.class.code })}
                            >
                              Tìm người dạy thay
                            </Button>
                          )
                        }
                      >
                        <span>
                          <b>{formatDateVN(s.date, true)}</b> {s.startTime} · <Link href={`/classes/${s.class.id}`}>{s.class.code}</Link> ·{" "}
                          {s.teacher.displayName} nghỉ <span className="sub">({s.leaveReason})</span>
                        </span>
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "reserve",
                label: <TabLabel text="Bảo lưu đến hạn" count={att.reservationsDue.length} color="var(--fgColor-done)" />,
                children: (
                  <List
                    size="small"
                    locale={{ emptyText: "Không có học sinh nào sắp hết bảo lưu trong 7 ngày tới." }}
                    dataSource={att.reservationsDue}
                    renderItem={(r) => (
                      <List.Item
                        extra={
                          <Tag color={r.expectedReturn < today ? "red" : "purple"}>
                            {r.expectedReturn < today ? "Quá hạn" : "Quay lại"} {formatDateVN(r.expectedReturn)}
                          </Tag>
                        }
                      >
                        <span>
                          {studentLink(r.student)} <span className="sub">· bảo lưu từ {formatDateVN(r.startDate)}</span>
                        </span>
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "followups",
                label: <TabLabel text="Cần gọi lại" count={att.followUpsDue} color="var(--fgColor-danger)" />,
                children: (
                  <div style={{ padding: "8px 0" }}>
                    {att.followUpsDue ? `${att.followUpsDue} việc hẹn gọi lại phụ huynh đã đến hạn. ` : "Không có việc gọi lại nào đến hạn. "}
                    <Link href="/followups">Mở trang Cần gọi lại</Link>
                  </div>
                ),
              },
              {
                key: "advise",
                label: <TabLabel text="Tư vấn khóa tiếp" count={att.toAdvise.length} color="var(--fgColor-accent)" />,
                children: (
                  <List
                    size="small"
                    locale={{ emptyText: "Không có học sinh nào vừa học xong mà chưa có lớp tiếp theo." }}
                    dataSource={att.toAdvise}
                    renderItem={(e) => (
                      <List.Item extra={<OutcomeTag value={e.outcome} />}>
                        <span>
                          {studentLink(e.student)} · xong <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link>
                          {e.class.course ? <span className="sub"> ({e.class.course.name})</span> : null}
                        </span>
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "makeup",
                label: <TabLabel text="Vắng chưa bù" count={att.pendingMakeups} color="var(--fgColor-done)" />,
                children: (
                  <div style={{ padding: "8px 0" }}>
                    {att.pendingMakeups ? `${att.pendingMakeups} buổi vắng trong 60 ngày qua chưa xếp học bù. ` : "Không có buổi vắng nào chờ bù. "}
                    <Link href="/makeups">Mở trang Học bù</Link>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
      <SubstituteModal
        session={sub}
        onClose={() => setSub(null)}
        onSaved={() => {
          setSub(null);
          void reloadAttention();
        }}
      />
    </>
  );
}
