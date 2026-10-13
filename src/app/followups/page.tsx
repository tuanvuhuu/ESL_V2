"use client";

import { App, Button, Card, Col, Empty, List, Popconfirm, Row, Skeleton, Space, Tag } from "@/client/primer-compat";
import Link from "next/link";
import { useState } from "react";
import { api, qs, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import { ContactModal, type ContactTarget } from "@/components/contacts/ContactModal";
import type { ContactRow } from "@/components/contacts/ContactList";
import { CenterTag, PageHeader } from "@/components/ui";
import { CONTACT_CHANNELS, optionOf } from "@/lib/constants";
import { addDays, formatDateVN, todayISO } from "@/lib/dates";
import { canEditCenter } from "@/lib/permissions";
import { formatPhone } from "@/lib/text";

/** Việc cần gọi lại (M7): nhóm Quá hạn / Hôm nay / Sắp tới; ghi kết quả cuộc gọi hoặc đánh dấu xong. */
export default function FollowUpsPage() {
  const { message } = App.useApp();
  const viewer = useViewer();
  const { centerId } = useCenters();
  const { data, loading, reload } = useApi<ContactRow[]>(`/api/followups${qs({ centerId })}`);
  const [target, setTarget] = useState<ContactTarget | null>(null);
  const today = todayISO();
  const rows = data ?? [];
  const groups = [
    { key: "overdue", title: "Quá hạn", color: "var(--fgColor-danger)", items: rows.filter((r) => r.followUpDate! < today) },
    { key: "today", title: "Hôm nay", color: "var(--fgColor-attention)", items: rows.filter((r) => r.followUpDate === today) },
    { key: "soon", title: "Sắp tới", color: "var(--fgColor-accent)", items: rows.filter((r) => r.followUpDate! > today) },
  ];

  const done = async (id: number) => {
    try {
      await api(`/api/contacts/${id}`, { method: "PATCH", body: {} });
      message.success("Đã đánh dấu xong");
      void reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Cần gọi lại" description="Các lần liên lạc có hẹn gọi lại chưa xử lý. Ghi liên lạc mới ở hồ sơ học sinh, tab Liên lạc." />
      {loading && !data ? (
        <Skeleton active />
      ) : (
        <Row gutter={[16, 16]}>
          {groups.map((g) => (
            <Col key={g.key} xs={24} lg={8}>
              <Card
                size="small"
                style={{ borderTop: `3px solid ${g.color}` }}
                title={
                  <span style={{ color: g.color }}>
                    {g.title} <span className="sub">· {g.items.length}</span>
                  </span>
                }
              >
                {g.items.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có." />
                ) : (
                  <List
                    dataSource={g.items}
                    renderItem={(c) => {
                      const editable = canEditCenter(viewer, c.student.centerId);
                      return (
                        <List.Item style={{ display: "block" }}>
                          <Space wrap size={[6, 2]}>
                            <Link href={`/students/${c.student.id}`}>
                              <b>{c.student.fullName}</b>
                            </Link>
                            <span className="sub">{c.student.code}</span>
                            <CenterTag center={c.student.center} />
                            {g.key !== "today" && (
                              <Tag color={g.key === "overdue" ? "red" : "blue"}>
                                {formatDateVN(c.followUpDate!)}
                                {g.key === "soon" && c.followUpDate! <= addDays(today, 1) ? " (mai)" : ""}
                              </Tag>
                            )}
                          </Space>
                          <div style={{ margin: "4px 0" }}>{c.followUpNote}</div>
                          <div className="sub">
                            Lần trước: {optionOf(CONTACT_CHANNELS, c.channel)?.label?.toLowerCase()} {formatDateVN(c.createdAt.slice(0, 10))} · {c.content}
                          </div>
                          {c.parent && (
                            <div className="sub">
                              {c.parent.fullName} · <a href={`tel:${c.parent.phone}`}>{formatPhone(c.parent.phone)}</a>
                            </div>
                          )}
                          {editable && (
                            <Space style={{ marginTop: 6 }}>
                              <Button
                                size="small"
                                type="primary"
                                onClick={() =>
                                  setTarget({
                                    studentId: c.student.id,
                                    studentName: c.student.fullName,
                                    parents: c.parent ? [c.parent] : [],
                                    followUp: { id: c.id, note: c.followUpNote },
                                  })
                                }
                              >
                                Ghi kết quả
                              </Button>
                              <Popconfirm title="Đánh dấu đã xong, không ghi thêm?" okText="Xong" cancelText="Hủy" onConfirm={() => done(c.id)}>
                                <Button size="small">Xong</Button>
                              </Popconfirm>
                            </Space>
                          )}
                        </List.Item>
                      );
                    }}
                  />
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}
      <ContactModal
        target={target}
        onClose={() => setTarget(null)}
        onSaved={() => {
          setTarget(null);
          void reload();
        }}
      />
    </>
  );
}
