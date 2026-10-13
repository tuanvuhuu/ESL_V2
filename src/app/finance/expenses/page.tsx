"use client";

import { useEffect, useState } from "react";
import { PlusIcon, TrashIcon } from "@primer/octicons-react";
import { Button, IconButton, Popconfirm, Select, message } from "@/client/primer-compat";
import { api, qs } from "@/client/api";
import { PrimerGrid } from "@/components/PrimerGrid";
import { useCenters } from "@/client/centers";
import { DotLabel, PageHeader } from "@/components/ui";
import { ExpenseModal, EXPENSE_CATEGORIES } from "@/components/finance/ExpenseModal";
import { formatCurrency } from "@/lib/finance";
import { formatDateVN } from "@/lib/dates";

export default function ExpensesPage() {
  const { centers, centerId } = useCenters();

  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const query = qs({
        centerId: centerId || undefined,
        category: categoryFilter === "ALL" ? undefined : categoryFilter,
      });
      const data = await api.get<any[]>(`/api/finance/expenses${query}`);
      setExpenses(data);
    } catch (err: any) {
      message.error(err.message || "Không thể tải danh sách chi phí");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [centerId, categoryFilter]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/finance/expenses/${id}`);
      message.success("Đã xóa khoản chi thành công");
      loadExpenses();
    } catch (err: any) {
      message.error(err.message || "Không thể xóa khoản chi");
    }
  };

  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  const columns = [
    {
      title: "Mã chi",
      dataIndex: "code",
      key: "code",
      render: (code: string) => <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--fgColor-accent)" }}>{code}</span>,
    },
    {
      title: "Ngày chi",
      dataIndex: "date",
      key: "date",
      render: (date: string) => formatDateVN(date),
    },
    {
      title: "Trung tâm",
      key: "center",
      render: (_: any, row: any) => <DotLabel color={row.center.color}>{row.center.name}</DotLabel>,
    },
    {
      title: "Khoản mục",
      dataIndex: "category",
      key: "category",
      render: (cat: string) => {
        const item = EXPENSE_CATEGORIES.find((c) => c.value === cat);
        return (
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 500,
              background: "var(--bgColor-muted)",
              border: "1px solid var(--borderColor-default)",
              color: "var(--fgColor-default)",
            }}
          >
            {item?.label ?? cat}
          </span>
        );
      },
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      key: "amount",
      align: "right" as const,
      render: (val: number) => (
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--fgColor-danger)" }}>
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      title: "Người chi",
      dataIndex: "payer",
      key: "payer",
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      key: "note",
      render: (note?: string | null) => note || "—",
    },
    {
      title: "Người tạo",
      dataIndex: "createdBy",
      key: "createdBy",
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "center" as const,
      render: (_: any, row: any) => (
        <Popconfirm
          title="Xóa khoản chi này?"
          description="Khoản chi sẽ bị xóa vĩnh viễn khỏi hệ thống."
          onConfirm={() => handleDelete(row.id)}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <IconButton
            icon={TrashIcon}
            aria-label="Xóa khoản chi"
            size="small"
            variant="danger"
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <PageHeader
        title="Quản lý chi phí trung tâm"
        description="Theo dõi các khoản chi phí hoạt động, mặt bằng, điện nước, marketing theo trung tâm"
        actions={
          <Button type="primary" icon={<PlusIcon />} onClick={() => setModalOpen(true)}>
            Thêm khoản chi
          </Button>
        }
      />

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <div
          style={{
            background: "var(--bgColor-default)",
            border: "1px solid var(--borderColor-default)",
            borderRadius: 6,
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Tổng chi phí ({expenses.length} khoản):</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fgColor-danger)", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(totalExpense)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--fgColor-muted)" }}>Khoản mục:</span>
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 190 }}
            options={[
              { label: "Tất cả khoản mục", value: "ALL" },
              ...EXPENSE_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
            ]}
          />
        </div>
      </div>

      <PrimerGrid
        dataSource={expenses}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true }}
      />

      <ExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => loadExpenses()}
      />
    </div>
  );
}
