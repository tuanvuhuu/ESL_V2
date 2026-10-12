"use client";

import { CalendarOutlined, StopOutlined, SwapOutlined, UserOutlined } from "@ant-design/icons";
import { Col, Empty, Row, Statistic, Tag } from "antd";
import Link from "next/link";
import { qs, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import type { ScheduleSession } from "@/client/types";
import { PageHeader } from "@/components/ui";
import { formatDateVN, todayISO } from "@/lib/dates";

/** Lịch hôm nay của 4 trung tâm (DESIGN 6.4). */
export default function TodayPage() {
  const today = todayISO();
  const { centers, centerId } = useCenters();
  const { data } = useApi<ScheduleSession[]>(`/api/schedule${qs({ from: today, to: today, centerId })}`);
  const shown = centerId ? centers.filter((c) => c.id === centerId) : centers;
  const sessions = data ?? [];
  const active = sessions.filter((s) => s.status !== "CANCELLED");
  const cancelled = sessions.length - active.length;
  const stats = [
    { title: "Buổi học", value: active.length, icon: <CalendarOutlined />, color: "#1F6FEB" },
    { title: "Học sinh theo lịch", value: active.reduce((n, s) => n + s.class._count.enrollments, 0), icon: <UserOutlined />, color: "#2DA44E" },
    { title: "Buổi bị hủy", value: cancelled, icon: <StopOutlined />, color: "#CF222E", alert: cancelled > 0 },
    { title: "Dạy thay", value: active.filter((s) => s.teacherId !== s.class.teacherId).length, icon: <SwapOutlined />, color: "#8250DF" },
  ];

  return (
    <>
      <PageHeader title="Hôm nay" description={formatDateVN(today, true)} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {stats.map((st) => (
          <Col key={st.title} xs={12} md={6}>
            <div className="panel stat-card">
              <span className="stat-icon" style={{ color: st.color, background: `${st.color}14` }}>
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
                    </div>
                    {s.status === "CANCELLED" && <Tag color="red">Đã hủy</Tag>}
                    {s.status !== "CANCELLED" && s.teacherId !== s.class.teacherId && <Tag color="purple">Dạy thay</Tag>}
                  </div>
                ))}
              </div>
            </Col>
          );
        })}
      </Row>
    </>
  );
}
