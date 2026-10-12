"use client";

import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Card, Col, Descriptions, Empty, Row, Skeleton, Space, Table, Tabs, Tag } from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { qs, useApi } from "@/client/api";
import { useViewer } from "@/client/session";
import type { Teacher } from "@/client/types";
import { AuditTimeline } from "@/components/AuditTimeline";
import { AvailabilityEditor } from "@/components/staffing/AvailabilityEditor";
import { LeavePanel } from "@/components/staffing/LeavePanel";
import { TeacherFormModal } from "@/components/teachers/TeacherFormModal";
import { CenterTag, Dash, PageHeader, PersonAvatar, StatusTag } from "@/components/ui";
import { CLASS_STATUSES, EMPLOYMENTS, TEACHER_ORIGINS, TEACHER_ROLES, TEACHER_STATUSES, weekdayText, optionOf } from "@/lib/constants";
import { addDays, formatDateVN, startOfWeek, todayISO } from "@/lib/dates";
import { canEditCenter, canEditTeachers, canManageTeacherTime, canSeeAudit } from "@/lib/permissions";
import { formatPhone } from "@/lib/text";

type ClassLite = {
  id: number;
  code: string;
  name: string;
  status: string;
  weekdays: string;
  startTime: string;
  endTime: string;
  center: { name: string; color: string };
  room: { name: string };
};
type Detail = Teacher & {
  mainClasses: ClassLite[];
  assistantIn: { class: ClassLite }[];
  weekStart: string;
  week: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    teacherId: number;
    class: { id: number; code: string; name: string; center: { name: string; color: string } };
    room: { name: string };
  }[];
};

const wd = weekdayText;

export default function TeacherProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [week, setWeek] = useState(startOfWeek(todayISO()));
  const { data: t, loading, reload } = useApi<Detail>(`/api/teachers/${id}${qs({ week })}`);
  const [editing, setEditing] = useState(false);
  const viewer = useViewer();

  if (loading && !t) return <Skeleton active />;
  if (!t) return <Empty description="Không tìm thấy giáo viên" />;

  const classes = [
    ...t.mainClasses.map((c) => ({ ...c, as: "Giáo viên chính" })),
    ...t.assistantIn.map((a) => ({ ...a.class, as: "Trợ giảng" })),
  ];

  const days = Array.from({ length: 7 }, (_, i) => addDays(t.weekStart, i));
  const timeEditable = canManageTeacherTime(
    viewer,
    t.id,
    t.centers.map((c) => c.centerId),
  );

  const overview = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card size="small" title="Thông tin">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Họ tên">{t.fullName}</Descriptions.Item>
            <Descriptions.Item label="Vai trò">{optionOf(TEACHER_ROLES, t.role)?.label}</Descriptions.Item>
            <Descriptions.Item label="Loại">
              {optionOf(TEACHER_ORIGINS, t.origin)?.label} · {optionOf(EMPLOYMENTS, t.employment)?.label}
            </Descriptions.Item>
            <Descriptions.Item label="SĐT">{t.phone ? <a href={`tel:${t.phone}`}>{formatPhone(t.phone)}</a> : <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Email">{t.email ?? <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Trung tâm">
              {t.centers.map((c) => (
                <CenterTag key={c.centerId} center={c.center} />
              ))}
            </Descriptions.Item>
            <Descriptions.Item label="Bằng cấp">{t.qualifications ?? <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Bắt đầu">{t.startDate ? formatDateVN(t.startDate) : <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Ghi chú">{t.note ?? <Dash />}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} lg={15}>
        <Card
          size="small"
          title={`Lịch tuần ${formatDateVN(days[0])} – ${formatDateVN(days[6])}`}
          extra={
            <Space>
              <Button size="small" icon={<LeftOutlined />} onClick={() => setWeek(addDays(t.weekStart, -7))} />
              <Button size="small" onClick={() => setWeek(startOfWeek(todayISO()))}>
                Tuần này
              </Button>
              <Button size="small" icon={<RightOutlined />} onClick={() => setWeek(addDays(t.weekStart, 7))} />
            </Space>
          }
        >
          {days.map((d) => {
            const items = t.week.filter((s) => s.date === d);
            return (
              <div key={d} style={{ marginBottom: 8 }}>
                <div className="sub" style={{ fontWeight: 600 }}>
                  {formatDateVN(d, true)}
                </div>
                {items.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  items.map((s) => (
                    <div
                      key={s.id}
                      className="session-item"
                      style={{ borderLeftColor: s.class.center.color, textDecoration: s.status === "CANCELLED" ? "line-through" : undefined }}
                    >
                      <b className="num">
                        {s.startTime}–{s.endTime}
                      </b>{" "}
                      · <Link href={`/classes/${s.class.id}`}>{s.class.code}</Link> · phòng {s.room.name} · {s.class.center.name}{" "}
                      {s.teacherId !== t.id ? <Tag color="purple">Trợ giảng</Tag> : null}
                      {s.status === "CANCELLED" ? <Tag color="red">Đã hủy</Tag> : null}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </Card>
      </Col>
    </Row>
  );

  const classTable = (
    <Table
      rowKey={(r) => `${r.as}-${r.id}`}
      pagination={false}
      dataSource={classes}
      locale={{ emptyText: "Chưa dạy lớp nào." }}
      columns={[
        { title: "Lớp", render: (_, c) => <Link href={`/classes/${c.id}`}>{c.code}</Link> },
        { title: "Tên lớp", dataIndex: "name" },
        { title: "Vai trò", dataIndex: "as" },
        { title: "Trung tâm", render: (_, c) => <CenterTag center={c.center} /> },
        { title: "Lịch", render: (_, c) => `${wd(c.weekdays)} · ${c.startTime}–${c.endTime} · ${c.room.name}` },
        { title: "Trạng thái", render: (_, c) => <StatusTag options={CLASS_STATUSES} value={c.status} /> },
      ]}
    />
  );

  return (
    <>
      <PageHeader
        title={
          <Space>
            <PersonAvatar name={t.displayName} color={t.centers[0]?.center.color} size={40} />
            {t.displayName}
            <StatusTag options={TEACHER_STATUSES} value={t.status} />
          </Space>
        }
        description={`${t.code} · ${optionOf(TEACHER_ROLES, t.role)?.label}`}
        actions={
          canEditTeachers(viewer) && (
            <Button type="primary" onClick={() => setEditing(true)}>
              Sửa
            </Button>
          )
        }
      />
      <div className="panel">
        <Tabs
          defaultActiveKey={typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("tab") ?? undefined) : undefined}
          items={[
            { key: "overview", label: "Tổng quan", children: overview },
            { key: "classes", label: `Lớp (${classes.length})`, children: classTable },
            {
              key: "availability",
              label: "Lịch rảnh",
              children: <AvailabilityEditor teacherId={t.id} centers={t.centers.map((c) => c.center)} editable={timeEditable} />,
            },
            {
              key: "leaves",
              label: "Ngày nghỉ",
              children: <LeavePanel teacherId={t.id} editable={timeEditable} canArrange={(centerId) => canEditCenter(viewer, centerId)} />,
            },
            ...(canSeeAudit(viewer) ? [{ key: "audit", label: "Lịch sử thay đổi", children: <AuditTimeline entity="Teacher" id={t.id} /> }] : []),
          ]}
        />
      </div>
      <TeacherFormModal
        open={editing}
        teacher={t}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void reload();
        }}
      />
    </>
  );
}
