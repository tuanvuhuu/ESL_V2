"use client";

import { DownloadOutlined, PlusOutlined, SearchOutlined } from "@/client/primer-icons";
import { App, Button, Empty, Input, Select } from "@/client/primer-compat";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, qs, useApi, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import { downloadCsv } from "@/client/csv";
import type { Student, StudentRow } from "@/client/types";
import { useColumnSettings, type ColumnDef } from "@/components/ColumnSettings";
import { StatusModal } from "@/components/students/StatusModal";
import { StudentFormModal } from "@/components/students/StudentFormModal";
import { StudentViewDrawer } from "@/components/students/StudentViewDrawer";
import { ActionMenu, Dash, DotLabel, PageHeader, StatusTag, TwoLine } from "@/components/ui";
import { PrimerGrid } from "@/components/PrimerGrid";
import { GENDERS, STUDENT_STATUSES, optionOf } from "@/lib/constants";
import { ageFrom, formatDateVN, todayISO } from "@/lib/dates";
import { canCreateRecords, canEditCenter, canSeeParents } from "@/lib/permissions";
import { formatPhone } from "@/lib/text";

type ListResult = { items: StudentRow[]; total: number; counts: Record<string, number> };

export default function StudentsPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { centerId } = useCenters();
  const viewer = useViewer();
  const canAdd = canCreateRecords(viewer);
  const seeParents = canSeeParents(viewer);
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<{ field?: string; order?: "asc" | "desc" }>({});
  const [editing, setEditing] = useState<Student | null | undefined>(undefined);
  const [statusFor, setStatusFor] = useState<{ s: StudentRow; to?: string } | null>(null);
  const [viewing, setViewing] = useState<StudentRow | null>(null);

  useEffect(() => setPage(1), [dq, status, centerId]);

  const params = {
    q: dq,
    centerId,
    status: status === "ALL" ? undefined : status,
    sort: sort.field,
    order: sort.order,
  };
  const url = `/api/students${qs({ ...params, page, pageSize })}`;
  const { data, loading, reload } = useApi<ListResult>(url);
  const today = todayISO();

  const defs = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      { key: "code", title: "Mã", dataIndex: "code", width: 110, defaultPin: "left", sorter: true, render: (v: string) => <span className="num">{v}</span> },
      {
        key: "fullName",
        title: "Học sinh",
        width: 240,
        defaultPin: "left",
        sorter: true,
        render: (_, r) => (
          <TwoLine
            main={
              <button
                type="button"
                className="cell-main-btn"
                onClick={() => setViewing(r)}
              >
                {r.fullName}
              </button>
            }
            sub={r.englishName}
          />
        ),
      },
      {
        key: "dob",
        title: "Tuổi",
        width: 120,
        sorter: true,
        render: (_, r) => <TwoLine main={<span className="num">{ageFrom(r.dob, today)} tuổi</span>} sub={formatDateVN(r.dob)} />,
      },
      { key: "gender", title: "Giới tính", width: 90, defaultHidden: true, render: (_, r) => optionOf(GENDERS, r.gender)?.label },
      { key: "center", title: "Trung tâm", width: 130, render: (_, r) => <DotLabel color={r.center.color}>{r.center.name}</DotLabel> },
      {
        key: "class",
        title: "Lớp đang học",
        width: 160,
        render: (_, r) =>
          r.enrollments.length ? (
            r.enrollments.map((e) => (
              <div key={e.id}>
                <Link href={`/classes/${e.class.id}`}>{e.class.code}</Link> <span className="sub">{e.class.name}</span>
              </div>
            ))
          ) : (
            <Dash />
          ),
      },
      { key: "status", title: "Trạng thái", width: 150, render: (_, r) => <StatusTag options={STUDENT_STATUSES} value={r.status} sub={r.statusReason} /> },
      {
        key: "parent",
        title: "Phụ huynh chính",
        width: 200,
        render: (_, r) => {
          const g = r.guardians.find((x) => x.isPrimary) ?? r.guardians[0];
          if (g && !seeParents) return <TwoLine main={g.parent.fullName} sub={g.relation} />;
          return g ? (
            <TwoLine main={<Link href={`/parents/${g.parent.id}`}>{g.parent.fullName}</Link>} sub={`${g.relation} · ${formatPhone(g.parent.phone)}`} />
          ) : (
            <Dash />
          );
        },
      },
      { key: "school", title: "Trường", width: 160, defaultHidden: true, render: (_, r) => r.school ?? <Dash /> },
      {
        key: "actions",
        title: "",
        width: 48,
        required: true,
        defaultPin: "right",
        render: (_, r) => {
          const g = seeParents ? (r.guardians.find((x) => x.isPrimary) ?? r.guardians[0]) : undefined;
          const editable = canEditCenter(viewer, r.center.id);
          return (
            <ActionMenu
              title={`${r.fullName} · ${r.code}`}
              items={[
                { key: "view", label: "Xem hồ sơ", onClick: () => setViewing(r) },
                ...(editable
                  ? [
                      { key: "edit", label: "Sửa thông tin", onClick: () => setEditing(r) },
                      { key: "status", label: "Đổi trạng thái", onClick: () => setStatusFor({ s: r }) },
                    ]
                  : []),
                ...(g
                  ? [
                      { type: "divider" as const },
                      { key: "call", label: <a href={`tel:${g.parent.phone}`}>Gọi phụ huynh</a> },
                      {
                        key: "copy",
                        label: "Sao chép SĐT phụ huynh",
                        onClick: () => {
                          void navigator.clipboard?.writeText(g.parent.phone);
                          message.success(`Đã sao chép ${formatPhone(g.parent.phone)}`);
                        },
                      },
                    ]
                  : []),
                ...(editable
                  ? [
                      { type: "divider" as const },
                      ...(r.status === "STUDYING" ? [{ key: "reserve", label: "Bảo lưu", onClick: () => setStatusFor({ s: r, to: "RESERVED" }) }] : []),
                      ...(r.status === "RESERVED" || r.status === "PAUSED"
                        ? [{ key: "back", label: "Học lại", onClick: () => setStatusFor({ s: r, to: "STUDYING" }) }]
                        : []),
                      ...(r.status !== "QUIT"
                        ? [{ key: "quit", danger: true, label: "Cho nghỉ học", onClick: () => setStatusFor({ s: r, to: "QUIT" }) }]
                        : []),
                    ]
                  : []),
              ]}
            />
          );
        },
      },
    ],
    [router, message, today, viewer, seeParents],
  );
  const { columns, button } = useColumnSettings("students", defs);

  const exportCsv = async () => {
    const all = await api<ListResult>(`/api/students${qs({ ...params, page: 1, pageSize: 5000 })}`);
    downloadCsv(
      `hoc-sinh-${today}.csv`,
      ["Mã", "Họ tên", "Tên tiếng Anh", "Ngày sinh", "Giới tính", "Trung tâm", "Lớp đang học", "Trạng thái", "Lý do", "Phụ huynh chính", "Quan hệ", "SĐT phụ huynh"],
      all.items.map((r) => {
        const g = r.guardians.find((x) => x.isPrimary) ?? r.guardians[0];
        return [
          r.code,
          r.fullName,
          r.englishName,
          formatDateVN(r.dob),
          optionOf(GENDERS, r.gender)?.label,
          r.center.name,
          r.enrollments.map((e) => e.class.code).join(" "),
          optionOf(STUDENT_STATUSES, r.status)?.label,
          r.statusReason,
          g?.parent.fullName,
          g?.relation,
          g ? formatPhone(g.parent.phone) : "",
        ];
      }),
    );
  };

  const counts = data?.counts ?? {};
  const filtered = !!dq || status !== "ALL";

  return (
    <>
      <PageHeader
        title="Danh sách học sinh"
        description={`${data?.total ?? 0} học sinh`}
      />
      <div>
        <PrimerGrid<StudentRow>
          selectable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data?.items}
          scroll={{ x: "max-content" }}
          toolbar={
            <>
              <Input
                allowClear
                prefix={<SearchOutlined style={{ color: "var(--fgColor-muted)" }} />}
                placeholder="Tìm mã, tên, SĐT"
                style={{ width: 260 }}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Select
                value={status}
                onChange={setStatus}
                style={{ width: 160 }}
                popupMatchSelectWidth={false}
                options={[
                  { value: "ALL", label: `Tất cả (${counts.ALL ?? 0})` },
                  ...STUDENT_STATUSES.map((s) => ({ value: s.value, label: `${s.label} (${counts[s.value] ?? 0})` })),
                ]}
              />
            </>
          }
          actionsComponent={
            <>
              {button}
              {canAdd && (
                <>
                  <Button icon={<DownloadOutlined />} onClick={exportCsv}>
                    Xuất Excel
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
                    Thêm học sinh
                  </Button>
                </>
              )}
            </>
          }
          onChange={(_p, _f, sorter) => {
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            setSort(s?.order ? { field: String(s.columnKey), order: s.order === "ascend" ? "asc" : "desc" } : {});
          }}
          locale={{
            emptyText: (
              <Empty description={filtered ? "Không tìm thấy học sinh phù hợp." : "Chưa có học sinh nào."}>
                {filtered ? (
                  <Button
                    onClick={() => {
                      setQ("");
                      setStatus("ALL");
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : (
                  canAdd && (
                    <Button type="primary" onClick={() => setEditing(null)}>
                      Thêm học sinh
                    </Button>
                  )
                )}
              </Empty>
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total, [a, b]) => `${a}–${b} trong ${total} học sinh`,
            onChange: (p, ps) => {
              setPage(ps !== pageSize ? 1 : p);
              setPageSize(ps);
            },
          }}
        />
      </div>
      <StudentFormModal
        open={editing !== undefined}
        student={editing}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          const wasNew = editing === null;
          setEditing(undefined);
          if (wasNew) {
            setSort({});
            setPage(1);
          }
          void reload();
        }}
      />
      <StatusModal
        open={!!statusFor}
        student={statusFor?.s ?? null}
        initialStatus={statusFor?.to}
        onClose={() => setStatusFor(null)}
        onSaved={() => {
          setStatusFor(null);
          void reload();
        }}
      />
      <StudentViewDrawer
        open={!!viewing}
        student={viewing}
        canEdit={viewing ? canEditCenter(viewer, viewing.center.id) : false}
        onClose={() => setViewing(null)}
        onEdit={(s) => setEditing(s)}
        onStatus={(s) => setStatusFor({ s })}
      />
    </>
  );
}
