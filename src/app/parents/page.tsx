"use client";

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Input, Table } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { qs, useApi, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import type { CenterLite, Parent } from "@/client/types";
import { useColumnSettings, type ColumnDef } from "@/components/ColumnSettings";
import { ParentFormModal } from "@/components/parents/ParentFormModal";
import { ActionMenu, CenterTag, Dash, PageHeader } from "@/components/ui";
import { formatPhone } from "@/lib/text";

type Row = Parent & {
  children: { relation: string; student: { id: number; code: string; fullName: string; status: string; center: CenterLite } }[];
};

export default function ParentsPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { centerId } = useCenters();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [editing, setEditing] = useState<Parent | null | undefined>(undefined);
  const { data, loading, reload } = useApi<Row[]>(`/api/parents${qs({ q: dq, centerId })}`);

  const defs = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        key: "fullName",
        title: "Họ tên",
        width: 200,
        defaultPin: "left",
        render: (_, r) => <Link href={`/parents/${r.id}`}>{r.fullName}</Link>,
      },
      { key: "phone", title: "SĐT", width: 140, render: (_, r) => <span className="num">{formatPhone(r.phone)}</span> },
      { key: "zalo", title: "Zalo", width: 140, render: (_, r) => r.zalo ?? <Dash /> },
      { key: "count", title: "Số con", width: 80, align: "right", render: (_, r) => <span className="num">{r.children.length}</span> },
      {
        key: "children",
        title: "Các con",
        width: 260,
        render: (_, r) =>
          r.children.length ? (
            r.children.map((c) => (
              <div key={c.student.id}>
                <Link href={`/students/${c.student.id}`}>{c.student.fullName}</Link> <span className="sub">{c.relation}</span>
              </div>
            ))
          ) : (
            <Dash />
          ),
      },
      {
        key: "centers",
        title: "Trung tâm",
        width: 180,
        render: (_, r) => {
          const uniq = new Map(r.children.map((c) => [c.student.center.id, c.student.center]));
          return uniq.size ? Array.from(uniq.values()).map((c) => <CenterTag key={c.id} center={c} />) : <Dash />;
        },
      },
      {
        key: "actions",
        title: "",
        width: 56,
        required: true,
        defaultPin: "right",
        render: (_, r) => (
          <ActionMenu
            title={`${r.fullName} · ${formatPhone(r.phone)}`}
            items={[
              { key: "view", label: "Xem hồ sơ", onClick: () => router.push(`/parents/${r.id}`) },
              { key: "edit", label: "Sửa thông tin", onClick: () => setEditing(r) },
              { type: "divider" },
              { key: "call", label: <a href={`tel:${r.phone}`}>Gọi điện</a> },
              {
                key: "copy",
                label: "Sao chép SĐT",
                onClick: () => {
                  void navigator.clipboard?.writeText(r.phone);
                  message.success(`Đã sao chép ${formatPhone(r.phone)}`);
                },
              },
            ]}
          />
        ),
      },
    ],
    [router, message],
  );
  const { columns, button } = useColumnSettings("parents", defs);

  return (
    <>
      <PageHeader
        title="Phụ huynh"
        description="Một phụ huynh có thể có nhiều con; anh chị em được nhận ra qua phụ huynh chung"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
            Thêm phụ huynh
          </Button>
        }
      />
      <div className="panel">
        <div className="filter-bar">
          <Input.Search allowClear placeholder="Tìm tên, SĐT, tên con…" style={{ width: 280 }} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="spacer" />
          {button}
        </div>
        <Table<Row>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          scroll={{ x: "max-content", y: "calc(100vh - 330px)" }}
          locale={{ emptyText: dq ? "Không tìm thấy phụ huynh phù hợp." : "Chưa có phụ huynh nào." }}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, [a, b]) => `${a}–${b} trong ${total} phụ huynh`,
          }}
        />
      </div>
      <ParentFormModal
        open={editing !== undefined}
        parent={editing}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          void reload();
        }}
      />
    </>
  );
}
