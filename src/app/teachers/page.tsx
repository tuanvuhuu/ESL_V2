"use client";

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Input, Segmented, Table } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { qs, useApi, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import type { Teacher } from "@/client/types";
import { useColumnSettings, type ColumnDef } from "@/components/ColumnSettings";
import { TeacherFormModal } from "@/components/teachers/TeacherFormModal";
import { ActionMenu, CenterTag, CertTag, Dash, PageHeader, PersonAvatar, StatusTag, TwoLine } from "@/components/ui";
import { EMPLOYMENTS, TEACHER_ORIGINS, TEACHER_ROLES, TEACHER_STATUSES, optionOf } from "@/lib/constants";
import { canEditTeachers } from "@/lib/permissions";
import { formatPhone } from "@/lib/text";

type Row = Teacher & { activeClassCount: number; monthHours: number };

export default function TeachersPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { centerId } = useCenters();
  const canEdit = canEditTeachers(useViewer());
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [status, setStatus] = useState("ALL");
  const [editing, setEditing] = useState<Teacher | null | undefined>(undefined);
  const { data, loading, reload } = useApi<Row[]>(`/api/teachers${qs({ q: dq, centerId })}`);

  const rows = useMemo(() => (data ?? []).filter((t) => status === "ALL" || t.status === status), [data, status]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: data?.length ?? 0 };
    for (const t of data ?? []) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [data]);

  const defs = useMemo<ColumnDef<Row>[]>(
    () => [
      { key: "code", title: "Mã", dataIndex: "code", width: 90, defaultPin: "left" },
      {
        key: "name",
        title: "Giáo viên",
        width: 230,
        defaultPin: "left",
        render: (_, r) => (
          <div className="person-cell">
            <PersonAvatar name={r.displayName} color={r.centers[0]?.center.color} />
            <TwoLine main={<Link href={`/teachers/${r.id}`}>{r.displayName}</Link>} sub={r.fullName} />
          </div>
        ),
      },
      { key: "role", title: "Vai trò", width: 140, render: (_, r) => <StatusTag options={TEACHER_ROLES} value={r.role} /> },
      {
        key: "type",
        title: "Loại",
        width: 150,
        render: (_, r) => <TwoLine main={optionOf(TEACHER_ORIGINS, r.origin)?.label} sub={optionOf(EMPLOYMENTS, r.employment)?.label} />,
      },
      { key: "centers", title: "Trung tâm", width: 220, render: (_, r) => r.centers.map((c) => <CenterTag key={c.centerId} center={c.center} />) },
      { key: "phone", title: "SĐT", width: 130, render: (_, r) => (r.phone ? <span className="num">{formatPhone(r.phone)}</span> : <Dash />) },
      { key: "classes", title: "Lớp đang dạy", width: 110, align: "right", render: (_, r) => <span className="num">{r.activeClassCount}</span> },
      {
        key: "hours",
        title: "Giờ dạy tháng này",
        width: 140,
        align: "right",
        render: (_, r) => <span className="num">{r.monthHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</span>,
      },
      { key: "cert", title: "Chứng chỉ", width: 170, render: (_, r) => <CertTag expiry={r.certExpiry} always /> },
      { key: "status", title: "Trạng thái", width: 130, render: (_, r) => <StatusTag options={TEACHER_STATUSES} value={r.status} /> },
      {
        key: "actions",
        title: "",
        width: 56,
        required: true,
        defaultPin: "right",
        render: (_, r) => (
          <ActionMenu
            title={`${r.displayName} · ${r.code}`}
            items={[
              { key: "view", label: "Xem hồ sơ", onClick: () => router.push(`/teachers/${r.id}`) },
              ...(canEdit ? [{ key: "edit", label: "Sửa thông tin", onClick: () => setEditing(r) }] : []),
              ...(r.phone
                ? [
                    { type: "divider" as const },
                    { key: "call", label: <a href={`tel:${r.phone}`}>Gọi điện</a> },
                    {
                      key: "copy",
                      label: "Sao chép SĐT",
                      onClick: () => {
                        void navigator.clipboard?.writeText(r.phone!);
                        message.success(`Đã sao chép ${formatPhone(r.phone)}`);
                      },
                    },
                  ]
                : []),
              { type: "divider" as const },
              { key: "schedule", label: "Xem lịch dạy", onClick: () => router.push(`/schedule?teacherId=${r.id}`) },
            ]}
          />
        ),
      },
    ],
    [router, message, canEdit],
  );
  const { columns, button } = useColumnSettings("teachers", defs);

  return (
    <>
      <PageHeader
        title="Giáo viên và trợ giảng"
        description="Hồ sơ, trung tâm dạy và giờ dạy theo lịch"
        actions={
          canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
              Thêm giáo viên
            </Button>
          )
        }
      />
      <div className="panel">
        <div className="filter-bar">
          <Input.Search allowClear placeholder="Tìm tên, mã, SĐT…" style={{ width: 280 }} value={q} onChange={(e) => setQ(e.target.value)} />
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as string)}
            options={[
              { value: "ALL", label: `Tất cả ${counts.ALL}` },
              ...TEACHER_STATUSES.map((s) => ({ value: s.value, label: `${s.label} ${counts[s.value] ?? 0}` })),
            ]}
          />
          <div className="spacer" />
          {button}
        </div>
        <Table<Row>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: "max-content", y: "calc(100vh - 330px)" }}
          locale={{ emptyText: dq || status !== "ALL" ? "Không tìm thấy giáo viên phù hợp." : "Chưa có giáo viên nào." }}
          pagination={{
            defaultPageSize: 50,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total, [a, b]) => `${a}–${b} trong ${total} người`,
          }}
        />
      </div>
      <TeacherFormModal
        open={editing !== undefined}
        teacher={editing}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          void reload();
        }}
      />
    </>
  );
}
