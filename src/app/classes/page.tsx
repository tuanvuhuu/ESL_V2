"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, Input, Segmented, Table } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { qs, useApi, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import type { CenterLite } from "@/client/types";
import { ClassFormModal } from "@/components/classes/ClassFormModal";
import { useColumnSettings, type ColumnDef } from "@/components/ColumnSettings";
import { ActionMenu, CenterTag, Dash, PageHeader, StatusTag, TwoLine } from "@/components/ui";
import { PrimerGrid } from "@/components/PrimerGrid";
import { CLASS_STATUSES, weekdayText } from "@/lib/constants";
import { formatDateVN } from "@/lib/dates";
import { canCreateRecords } from "@/lib/permissions";

type Row = {
  id: number;
  code: string;
  name: string;
  status: string;
  weekdays: string;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string | null;
  maxStudents: number;
  sessionCount: number;
  center: CenterLite;
  room: { name: string; capacity: number };
  course: { name: string } | null;
  teacher: { id: number; displayName: string };
  assistants: { teacher: { id: number; displayName: string } }[];
  _count: { enrollments: number };
};

export default function ClassesPage() {
  const router = useRouter();
  const canAdd = canCreateRecords(useViewer());
  const { centerId } = useCenters();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [status, setStatus] = useState("ALL");
  const [creating, setCreating] = useState(false);
  const { data, loading, reload } = useApi<Row[]>(`/api/classes${qs({ q: dq, centerId })}`);

  const rows = useMemo(() => (data ?? []).filter((c) => status === "ALL" || c.status === status), [data, status]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: data?.length ?? 0 };
    for (const r of data ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [data]);

  const defs = useMemo<ColumnDef<Row>[]>(
    () => [
      { key: "code", title: "Mã", width: 110, defaultPin: "left", render: (_, r) => <Link href={`/classes/${r.id}`}>{r.code}</Link> },
      { key: "name", title: "Lớp", width: 200, defaultPin: "left", render: (_, r) => <TwoLine main={r.name} sub={r.course?.name} /> },
      { key: "center", title: "Trung tâm", width: 140, render: (_, r) => <CenterTag center={r.center} /> },
      {
        key: "schedule",
        title: "Lịch học",
        width: 170,
        render: (_, r) => <TwoLine main={`${weekdayText(r.weekdays)} · ${r.startTime}–${r.endTime}`} sub={`Phòng ${r.room.name}`} />,
      },
      {
        key: "staff",
        title: "Giáo viên / trợ giảng",
        width: 200,
        render: (_, r) => (
          <TwoLine
            main={<Link href={`/teachers/${r.teacher.id}`}>{r.teacher.displayName}</Link>}
            sub={r.assistants.map((a) => a.teacher.displayName).join(", ") || undefined}
          />
        ),
      },
      {
        key: "size",
        title: "Sĩ số",
        width: 90,
        align: "right",
        render: (_, r) => (
          <span className="num">
            {r._count.enrollments}/{r.maxStudents}
          </span>
        ),
      },
      {
        key: "dates",
        title: "Khai giảng – kết thúc",
        width: 200,
        render: (_, r) => <TwoLine main={`${formatDateVN(r.startDate)} – ${r.endDate ? formatDateVN(r.endDate) : "?"}`} sub={`${r.sessionCount} buổi`} />,
      },
      { key: "status", title: "Trạng thái", width: 120, render: (_, r) => <StatusTag options={CLASS_STATUSES} value={r.status} /> },
      {
        key: "actions",
        title: "",
        width: 56,
        required: true,
        defaultPin: "right",
        render: (_, r) => (
          <ActionMenu
            title={`${r.name} · ${r.code}`}
            items={[
              { key: "view", label: "Xem lớp", onClick: () => router.push(`/classes/${r.id}`) },
              { key: "schedule", label: "Xem lịch", onClick: () => router.push(`/schedule?classId=${r.id}`) },
            ]}
          />
        ),
      },
    ],
    [router],
  );
  const { columns, button } = useColumnSettings("classes", defs);

  return (
    <>
      <PageHeader
        title="Lớp học"
        description="Mở lớp, xếp học sinh và quản lý buổi học"
        actions={
          canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
              Mở lớp mới
            </Button>
          )
        }
      />
      <div className="panel">
        <div className="filter-bar">
          <Input.Search allowClear placeholder="Tìm mã, tên lớp, giáo viên…" style={{ width: 280 }} value={q} onChange={(e) => setQ(e.target.value)} />
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as string)}
            options={[
              { value: "ALL", label: `Tất cả ${counts.ALL}` },
              ...CLASS_STATUSES.map((s) => ({ value: s.value, label: `${s.label} ${counts[s.value] ?? 0}` })),
            ]}
          />
          <div className="spacer" />
          {button}
        </div>
        <PrimerGrid<Row>
          selectable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: "max-content", y: "calc(100vh - 330px)" }}
          locale={{ emptyText: dq || status !== "ALL" ? "Không tìm thấy lớp phù hợp." : <Dash /> }}
          pagination={{ defaultPageSize: 50, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (t, [a, b]) => `${a}–${b} trong ${t} lớp` }}
        />
      </div>
      <ClassFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => {
          setCreating(false);
          void reload();
          router.push(`/classes/${id}`);
        }}
      />
    </>
  );
}
