"use client";

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Descriptions, Empty, List, Popconfirm, Row, Skeleton, Space, Table, Tabs, Tag } from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api, useApi } from "@/client/api";
import { useViewer } from "@/client/session";
import type { Guardian, Student } from "@/client/types";
import { AuditTimeline } from "@/components/AuditTimeline";
import { AddGuardianModal } from "@/components/students/AddGuardianModal";
import { StatusModal } from "@/components/students/StatusModal";
import { StudentFormModal } from "@/components/students/StudentFormModal";
import { CenterTag, Dash, PageHeader, PersonAvatar, StatusTag } from "@/components/ui";
import { AUDIENCES, CLASS_STATUSES, GENDERS, STUDENT_STATUSES, optionOf } from "@/lib/constants";
import { ageFrom, formatDateVN } from "@/lib/dates";
import { canEditCenter, canSeeAudit, canSeeParents } from "@/lib/permissions";
import { formatPhone } from "@/lib/text";

type Detail = Student & {
  center: { id: number; name: string; color: string };
  guardians: (Guardian & {
    parent: Guardian["parent"] & { children: { student: { id: number; code: string; fullName: string; status: string } }[] };
  })[];
  enrollments: {
    id: number;
    joinedAt: string;
    leftAt: string | null;
    class: {
      id: number;
      code: string;
      name: string;
      status: string;
      weekdays: string;
      startTime: string;
      endTime: string;
      center: { name: string; color: string };
      teacher: { displayName: string };
      course: { name: string } | null;
    };
  }[];
  upcoming: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    class: { code: string; name: string };
    room: { name: string };
    teacher: { displayName: string };
  }[];
};

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { message } = App.useApp();
  const { data: s, loading, reload } = useApi<Detail>(`/api/students/${id}`);
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [addingGuardian, setAddingGuardian] = useState(false);
  const viewer = useViewer();

  if (loading && !s) return <Skeleton active />;
  if (!s) return <Empty description="Không tìm thấy học sinh" />;

  const editable = canEditCenter(viewer, s.center.id);
  const seeParents = canSeeParents(viewer);
  const siblings = new Map<number, { id: number; code: string; fullName: string; status: string }>();
  for (const g of s.guardians) for (const c of g.parent.children) siblings.set(c.student.id, c.student);

  const removeGuardian = async (parentId: number) => {
    try {
      await api(`/api/students/${s.id}/guardians`, { method: "DELETE", body: { parentId } });
      message.success("Đã gỡ phụ huynh");
      void reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const overview = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card title="Thông tin chính" size="small">
          <Descriptions column={{ xs: 1, md: 2 }} size="small">
            <Descriptions.Item label="Ngày sinh">
              {formatDateVN(s.dob)} ({ageFrom(s.dob)} tuổi)
            </Descriptions.Item>
            <Descriptions.Item label="Giới tính">{optionOf(GENDERS, s.gender)?.label}</Descriptions.Item>
            <Descriptions.Item label="Nhóm">{optionOf(AUDIENCES, s.audience)?.label}</Descriptions.Item>
            <Descriptions.Item label="Trường">{s.school ?? <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Trình độ đầu vào">{s.level ?? <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Trung tâm chính">
              <CenterTag center={s.center} />
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú" span={2}>
              {s.note ?? <Dash />}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="Lớp đang học" size="small" style={{ marginTop: 16 }}>
          <List
            locale={{ emptyText: "Chưa xếp lớp." }}
            dataSource={s.enrollments.filter((e) => !e.leftAt)}
            renderItem={(e) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link>
                      {e.class.name}
                      <StatusTag options={CLASS_STATUSES} value={e.class.status} />
                    </Space>
                  }
                  description={`${e.class.teacher.displayName} · ${e.class.startTime}–${e.class.endTime} · vào lớp ${formatDateVN(e.joinedAt)}`}
                />
              </List.Item>
            )}
          />
        </Card>
        <Card title="Lịch sắp tới" size="small" style={{ marginTop: 16 }}>
          <List
            size="small"
            locale={{ emptyText: "Không có buổi học sắp tới." }}
            dataSource={s.upcoming}
            renderItem={(u) => (
              <List.Item>
                <span style={{ textDecoration: u.status === "CANCELLED" ? "line-through" : undefined }}>
                  <b>{formatDateVN(u.date, true)}</b> · {u.startTime}–{u.endTime} · {u.class.code} · phòng {u.room.name} · {u.teacher.displayName}
                </span>
                {u.status === "CANCELLED" && <Tag color="red">Đã hủy</Tag>}
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card
          title="Phụ huynh"
          size="small"
          extra={
            editable &&
            s.guardians.length < 2 && (
              <Button size="small" icon={<PlusOutlined />} onClick={() => setAddingGuardian(true)}>
                Thêm
              </Button>
            )
          }
        >
          <List
            dataSource={s.guardians}
            renderItem={(g) => (
              <List.Item
                actions={[
                  ...(seeParents
                    ? [
                        <a key="call" href={`tel:${g.parent.phone}`}>
                          Gọi
                        </a>,
                      ]
                    : []),
                  ...(editable && s.guardians.length > 1
                    ? [
                        <Popconfirm key="rm" title="Gỡ phụ huynh này khỏi học sinh?" okText="Gỡ" cancelText="Hủy" onConfirm={() => removeGuardian(g.parentId)}>
                          <a className="muted">Gỡ</a>
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {seeParents ? <Link href={`/parents/${g.parent.id}`}>{g.parent.fullName}</Link> : g.parent.fullName}
                      {g.isPrimary && <Tag color="blue">Liên hệ chính</Tag>}
                      {g.isPayer && <Tag>Đóng tiền</Tag>}
                    </Space>
                  }
                  description={seeParents ? `${g.relation} · ${formatPhone(g.parent.phone)}${g.parent.zalo ? ` · Zalo ${g.parent.zalo}` : ""}` : g.relation}
                />
              </List.Item>
            )}
          />
        </Card>
        {seeParents && (
        <Card title="Anh chị em" size="small" style={{ marginTop: 16 }}>
          {siblings.size === 0 ? (
            <span className="muted">Không có.</span>
          ) : (
            <List
              size="small"
              dataSource={Array.from(siblings.values())}
              renderItem={(c) => (
                <List.Item>
                  <Link href={`/students/${c.id}`}>{c.fullName}</Link> <span className="sub">{c.code}</span>
                  <StatusTag options={STUDENT_STATUSES} value={c.status} />
                </List.Item>
              )}
            />
          )}
        </Card>
        )}
      </Col>
    </Row>
  );

  const history = (
    <Table
      rowKey="id"
      size="middle"
      pagination={false}
      dataSource={s.enrollments}
      locale={{ emptyText: "Chưa học lớp nào." }}
      columns={[
        { title: "Lớp", render: (_, e) => <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link> },
        { title: "Tên lớp", render: (_, e) => e.class.name },
        { title: "Khóa", render: (_, e) => e.class.course?.name ?? <Dash /> },
        { title: "Trung tâm", render: (_, e) => <CenterTag center={e.class.center} /> },
        { title: "Giáo viên", render: (_, e) => e.class.teacher.displayName },
        { title: "Vào lớp", render: (_, e) => formatDateVN(e.joinedAt) },
        { title: "Rời lớp", render: (_, e) => (e.leftAt ? formatDateVN(e.leftAt) : <Dash />) },
        { title: "Trạng thái lớp", render: (_, e) => <StatusTag options={CLASS_STATUSES} value={e.class.status} /> },
      ]}
    />
  );

  return (
    <>
      <PageHeader
        title={
          <Space>
            <PersonAvatar name={s.fullName} color={s.center.color} size={40} />
            <span>
              {s.fullName}
              {s.englishName ? <span className="sub"> ({s.englishName})</span> : null}
            </span>
            <StatusTag options={STUDENT_STATUSES} value={s.status} sub={s.statusReason} />
          </Space>
        }
        description={`${s.code} · ${s.center.name}`}
        actions={
          editable && (
            <>
              <Button onClick={() => setChangingStatus(true)}>Đổi trạng thái</Button>
              <Button type="primary" onClick={() => setEditing(true)}>
                Sửa
              </Button>
            </>
          )
        }
      />
      <div className="panel">
        <Tabs
          items={[
            { key: "overview", label: "Tổng quan", children: overview },
            { key: "classes", label: "Lịch sử lớp học", children: history },
            ...(canSeeAudit(viewer) ? [{ key: "audit", label: "Lịch sử thay đổi", children: <AuditTimeline entity="Student" id={s.id} /> }] : []),
          ]}
        />
      </div>
      <StudentFormModal
        open={editing}
        student={s}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void reload();
        }}
      />
      <StatusModal
        open={changingStatus}
        student={s}
        onClose={() => setChangingStatus(false)}
        onSaved={() => {
          setChangingStatus(false);
          void reload();
        }}
      />
      <AddGuardianModal
        studentId={s.id}
        open={addingGuardian}
        onClose={() => setAddingGuardian(false)}
        onSaved={() => {
          setAddingGuardian(false);
          void reload();
        }}
      />
    </>
  );
}
