"use client";

import { Button, Card, Col, Descriptions, Empty, Row, Skeleton, Space, Tabs } from "@/client/primer-compat";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useApi } from "@/client/api";
import type { Parent, Student } from "@/client/types";
import { AuditTimeline } from "@/components/AuditTimeline";
import { ContactList } from "@/components/contacts/ContactList";
import { ParentFormModal } from "@/components/parents/ParentFormModal";
import { CenterTag, Dash, PageHeader, PersonAvatar, StatusTag } from "@/components/ui";
import { STUDENT_STATUSES, weekdayText } from "@/lib/constants";
import { ageFrom } from "@/lib/dates";
import { formatPhone } from "@/lib/text";

type Detail = Parent & {
  children: {
    relation: string;
    isPrimary: boolean;
    student: Student & {
      center: { name: string; color: string };
      enrollments: { id: number; class: { id: number; code: string; name: string; weekdays: string; startTime: string; endTime: string } }[];
    };
  }[];
};

const wd = weekdayText;

export default function ParentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, loading, reload } = useApi<Detail>(`/api/parents/${id}`);
  const [editing, setEditing] = useState(false);

  if (loading && !p) return <Skeleton active />;
  if (!p) return <Empty description="Không tìm thấy phụ huynh" />;

  const info = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card size="small" title="Liên hệ">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="SĐT">
              <a href={`tel:${p.phone}`}>{formatPhone(p.phone)}</a>
            </Descriptions.Item>
            <Descriptions.Item label="Zalo">{p.zalo ?? <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Email">{p.email ?? <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Ghi chú">{p.note ?? <Dash />}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} lg={15}>
        <Row gutter={[16, 16]}>
          {p.children.length === 0 && (
            <Col span={24}>
              <Empty description="Chưa gắn với học sinh nào." />
            </Col>
          )}
          {p.children.map((c) => (
            <Col xs={24} md={12} key={c.student.id}>
              <Card size="small">
                <Space align="start">
                  <PersonAvatar name={c.student.fullName} color={c.student.center.color} />
                  <div>
                    <Link href={`/students/${c.student.id}`}>
                      <b>{c.student.fullName}</b>
                    </Link>{" "}
                    <span className="sub">
                      {c.student.code} · {ageFrom(c.student.dob)} tuổi · {c.relation}
                    </span>
                    <div style={{ margin: "4px 0" }}>
                      <CenterTag center={c.student.center} /> <StatusTag options={STUDENT_STATUSES} value={c.student.status} />
                    </div>
                    {c.student.enrollments.map((e) => (
                      <div key={e.id} className="sub">
                        <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link> · {wd(e.class.weekdays)} · {e.class.startTime}–{e.class.endTime}
                      </div>
                    ))}
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Col>
    </Row>
  );

  return (
    <>
      <PageHeader
        title={p.fullName}
        description={`${formatPhone(p.phone)} · ${p.children.length} con`}
        actions={
          <Button type="primary" onClick={() => setEditing(true)}>
            Sửa
          </Button>
        }
      />
      <div className="panel">
        <Tabs
          items={[
            { key: "info", label: "Tổng quan", children: info },
            {
              key: "contacts",
              label: "Nhật ký liên lạc",
              children: (
                <>
                  <div className="sub" style={{ marginBottom: 12 }}>
                    Mọi lần liên lạc về các con của phụ huynh này. Ghi liên lạc mới ở hồ sơ từng học sinh, tab Liên lạc.
                  </div>
                  <ContactList parentId={p.id} />
                </>
              ),
            },
            { key: "audit", label: "Lịch sử thay đổi", children: <AuditTimeline entity="Parent" id={p.id} /> },
          ]}
        />
      </div>
      <ParentFormModal
        open={editing}
        parent={p}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void reload();
        }}
      />
    </>
  );
}
