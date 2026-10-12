"use client";

import { App, Button, Popconfirm, Table, Tabs, Tag } from "antd";
import Link from "next/link";
import { useState } from "react";
import { api, qs, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import { AttendanceTag } from "@/components/attendance/parts";
import { MakeupModal, type AbsenceLite } from "@/components/makeups/MakeupModal";
import { CenterTag, PageHeader } from "@/components/ui";
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
    <>
      <Link href={`/students/${s.id}`}>{s.fullName}</Link>
      <div className="sub">
        {s.code} · {s.center.name}
      </div>
    </>
  );

  const pending = (
    <Table<Pending>
      rowKey="id"
      loading={loading}
      dataSource={data?.pending ?? []}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: "Không có buổi vắng nào chờ bù." }}
      columns={[
        { title: "Học sinh", render: (_, a) => student(a.student) },
        {
          title: "Buổi vắng",
          render: (_, a) => (
            <>
              <b>{formatDateVN(a.session.date, true)}</b> {a.session.startTime}
              <div className="sub">
                <Link href={`/classes/${a.session.class.id}`}>{a.session.class.code}</Link> · buổi {a.session.index}
              </div>
            </>
          ),
        },
        { title: "Khóa", render: (_, a) => a.session.class.course?.name ?? "—" },
        { title: "Trạng thái", render: (_, a) => <AttendanceTag status={a.status} /> },
        { title: "Ghi chú", render: (_, a) => a.comment ?? <span className="muted">—</span> },
        {
          title: "",
          render: (_, a) =>
            canEditCenter(viewer, a.student.centerId) && (
              <Button
                size="small"
                type="primary"
                ghost
                onClick={() => setAbsence({ id: a.id, studentName: a.student.fullName, classCode: a.session.class.code, date: a.session.date, index: a.session.index })}
              >
                Xếp học bù
              </Button>
            ),
        },
      ]}
    />
  );

  const booked = (
    <Table<Booked>
      rowKey="id"
      loading={loading}
      dataSource={data?.booked ?? []}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: "Chưa có lịch học bù sắp tới." }}
      columns={[
        { title: "Học sinh", render: (_, m) => student(m.student) },
        {
          title: "Bù cho buổi",
          render: (_, m) => (
            <>
              {formatDateVN(m.absence.session.date)} · {m.absence.session.class.code} buổi {m.absence.session.index}
              <div>
                <AttendanceTag status={m.absence.status} />
              </div>
            </>
          ),
        },
        {
          title: "Học bù vào",
          render: (_, m) => (
            <>
              <b>{formatDateVN(m.session.date, true)}</b> {m.session.startTime}–{m.session.endTime}
              <div className="sub">
                <Link href={`/sessions/${m.session.id}`}>{m.session.class.code}</Link> buổi {m.session.index} · phòng {m.session.room.name}{" "}
                <CenterTag center={m.session.class.center} />
              </div>
            </>
          ),
        },
        { title: "Kết quả", render: (_, m) => (m.attendance ? <AttendanceTag status={m.attendance.status} /> : <Tag color="purple">Chờ học bù</Tag>) },
        { title: "Người xếp", dataIndex: "createdBy" },
        {
          title: "",
          render: (_, m) =>
            !m.attendance &&
            canEditCenter(viewer, m.student.centerId) && (
              <Popconfirm title="Bỏ lịch học bù này?" okText="Bỏ" cancelText="Không" onConfirm={() => remove(m.id)}>
                <Button size="small" danger type="text">
                  Bỏ
                </Button>
              </Popconfirm>
            ),
        },
      ]}
    />
  );

  return (
    <>
      <PageHeader title="Học bù" description="Buổi vắng trong 60 ngày gần nhất chưa xếp bù, và lịch học bù đã xếp." />
      <div className="panel">
        <Tabs
          items={[
            { key: "pending", label: `Buổi vắng chưa bù (${data?.pending.length ?? 0})`, children: pending },
            { key: "booked", label: `Đã xếp học bù (${data?.booked.length ?? 0})`, children: booked },
          ]}
        />
      </div>
      <MakeupModal
        absence={absence}
        onClose={() => setAbsence(null)}
        onSaved={() => {
          setAbsence(null);
          void reload();
        }}
      />
    </>
  );
}
