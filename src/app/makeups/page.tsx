"use client";

import { App, Button, Popconfirm } from "@/client/primer-compat";
import Link from "next/link";
import { useState } from "react";
import { api, qs, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import { AttendanceTag } from "@/components/attendance/parts";
import { MakeupModal, type AbsenceLite } from "@/components/makeups/MakeupModal";
import { PrimerGrid, FilterTabs } from "@/components/PrimerGrid";
import { DotLabel, PageHeader } from "@/components/ui";
import { formatDateVN } from "@/lib/dates";
import { canEditCenter } from "@/lib/permissions";

type StudentLite = { id: number; code: string; fullName: string; englishName: string | null; centerId: number; center: { id: number; name: string; color: string } };
type SessionLite = { id: number; index: number; date: string; startTime: string; endTime: string; class: { id: number; code: string; name: string; course: { name: string } | null } };
type Pending = { id: number; status: string; comment: string | null; student: StudentLite; session: SessionLite };
type Booked = {
  id: number;
  createdBy: string;
  student: StudentLite;
  absence: { status: string; session: SessionLite };
  attendance: { status: string } | null;
  session: { id: number; date: string; startTime: string; endTime: string; index: number; room: { name: string }; class: { id: number; code: string; center: { id: number; name: string; color: string } } };
};

/** Học bù: buổi vắng chưa bù (60 ngày gần nhất) và lịch học bù đã xếp. */
export default function MakeupsPage() {
  const viewer = useViewer();
  const { message } = App.useApp();
  const { centerId } = useCenters();
  const { data, loading, reload } = useApi<{ pending: Pending[]; booked: Booked[] }>(`/api/makeups${qs({ centerId })}`);
  const [tab, setTab] = useState<"pending" | "booked">("pending");
  const [absence, setAbsence] = useState<AbsenceLite | null>(null);

  const remove = async (id: number) => {
    try {
      await api(`/api/makeups/${id}`, { method: "DELETE" });
      message.success("Đã bỏ lịch học bù");
      void reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const student = (s: StudentLite) => (
    <div>
      <Link href={`/students/${s.id}`} style={{ fontWeight: 600, color: "var(--fgColor-accent)" }}>
        {s.fullName}
      </Link>
      <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
        {s.code} · <DotLabel color={s.center.color}>{s.center.name}</DotLabel>
      </div>
    </div>
  );

  const pendingColumns = [
    { title: "Học sinh", key: "student", render: (_: any, a: Pending) => student(a.student) },
    {
      title: "Buổi vắng",
      key: "session",
      render: (_: any, a: Pending) => (
        <div>
          <b>{formatDateVN(a.session.date, true)}</b> {a.session.startTime}
          <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
            <Link href={`/classes/${a.session.class.id}`} style={{ color: "var(--fgColor-accent)" }}>
              {a.session.class.code}
            </Link>{" "}
            · buổi {a.session.index}
          </div>
        </div>
      ),
    },
    { title: "Khóa", key: "course", render: (_: any, a: Pending) => a.session.class.course?.name ?? "—" },
    { title: "Trạng thái", key: "status", render: (_: any, a: Pending) => <AttendanceTag status={a.status} /> },
    { title: "Ghi chú", key: "comment", render: (_: any, a: Pending) => a.comment ?? <span style={{ color: "var(--fgColor-muted)" }}>—</span> },
    {
      title: "Thao tác",
      key: "actions",
      align: "center" as const,
      render: (_: any, a: Pending) =>
        canEditCenter(viewer, a.student.centerId) && (
          <Button
            size="small"
            onClick={() =>
              setAbsence({
                id: a.id,
                studentName: a.student.fullName,
                classCode: a.session.class.code,
                date: a.session.date,
                index: a.session.index,
              })
            }
          >
            Xếp học bù
          </Button>
        ),
    },
  ];

  const bookedColumns = [
    { title: "Học sinh", key: "student", render: (_: any, m: Booked) => student(m.student) },
    {
      title: "Bù cho buổi",
      key: "absence",
      render: (_: any, m: Booked) => (
        <div>
          {formatDateVN(m.absence.session.date)} · {m.absence.session.class.code} buổi {m.absence.session.index}
          <div style={{ marginTop: 2 }}>
            <AttendanceTag status={m.absence.status} />
          </div>
        </div>
      ),
    },
    {
      title: "Học bù vào",
      key: "bookedSession",
      render: (_: any, m: Booked) => (
        <div>
          <b>{formatDateVN(m.session.date, true)}</b> {m.session.startTime}–{m.session.endTime}
          <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
            <Link href={`/sessions/${m.session.id}`} style={{ color: "var(--fgColor-accent)" }}>
              {m.session.class.code}
            </Link>{" "}
            buổi {m.session.index} · phòng {m.session.room.name} ·{" "}
            <DotLabel color={m.session.class.center.color}>{m.session.class.center.name}</DotLabel>
          </div>
        </div>
      ),
    },
    {
      title: "Kết quả",
      key: "result",
      render: (_: any, m: Booked) =>
        m.attendance ? (
          <AttendanceTag status={m.attendance.status} />
        ) : (
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 500,
              background: "var(--bgColor-done-muted)",
              border: "1px solid var(--borderColor-done-muted)",
              color: "var(--fgColor-done)",
            }}
          >
            Chờ học bù
          </span>
        ),
    },
    { title: "Người xếp", dataIndex: "createdBy", key: "createdBy" },
    {
      title: "Thao tác",
      key: "actions",
      align: "center" as const,
      render: (_: any, m: Booked) =>
        !m.attendance &&
        canEditCenter(viewer, m.student.centerId) && (
          <Popconfirm title="Bỏ lịch học bù này?" okText="Bỏ" cancelText="Không" onConfirm={() => remove(m.id)}>
            <Button size="small" danger>
              Bỏ
            </Button>
          </Popconfirm>
        ),
    },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <PageHeader
        title="Học bù"
        description="Buổi vắng trong 60 ngày gần nhất chưa xếp bù, và lịch học bù đã xếp."
      />

      <div style={{ marginBottom: 12 }}>
        <FilterTabs
          value={tab}
          onChange={(v) => setTab(v as any)}
          items={[
            { value: "pending", label: "Buổi vắng chưa bù", count: data?.pending.length ?? 0 },
            { value: "booked", label: "Đã xếp học bù", count: data?.booked.length ?? 0 },
          ]}
        />
      </div>

      {tab === "pending" ? (
        <PrimerGrid<Pending>
          rowKey="id"
          loading={loading}
          dataSource={data?.pending ?? []}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          locale={{ emptyText: "Không có buổi vắng nào chờ bù." }}
          columns={pendingColumns}
        />
      ) : (
        <PrimerGrid<Booked>
          rowKey="id"
          loading={loading}
          dataSource={data?.booked ?? []}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          locale={{ emptyText: "Chưa có lịch học bù sắp tới." }}
          columns={bookedColumns}
        />
      )}

      <MakeupModal
        absence={absence}
        onClose={() => setAbsence(null)}
        onSaved={() => {
          setAbsence(null);
          void reload();
        }}
      />
    </div>
  );
}
