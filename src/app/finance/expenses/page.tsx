"use client";

import { useEffect, useState } from "react";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Popconfirm, Row, Select, Space, Tag, message } from "antd";
import { api, qs } from "@/client/api";
import { DataGrid } from "@/components/DataGrid";
import { useCenters } from "@/client/centers";
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
      render: (code: string) => <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{code}</span>,
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
      render: (_: any, row: any) => <Tag color={row.center.color}>{row.center.name}</Tag>,
    },
    {
      title: "Khoản mục",
      dataIndex: "category",
      key: "category",
      render: (cat: string) => {
        const item = EXPENSE_CATEGORIES.find((c) => c.value === cat);
        return <Tag color={item?.color}>{item?.label ?? cat}</Tag>;
      },
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      key: "amount",
      align: "right" as const,
      render: (val: number) => (
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#CF222E" }}>
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
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px 0" }}>Quản lý chi phí trung tâm</h1>
          <div style={{ color: "#59636E" }}>Theo dõi các khoản chi phí hoạt động, mặt bằng, điện nước, marketing theo trung tâm</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Thêm khoản chi
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "#59636E", fontSize: 13 }}>Tổng chi phí ({expenses.length} khoản)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#CF222E", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(totalExpense)}
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>Khoản mục:</span>
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 200 }}
            options={[
              { label: "Tất cả khoản mục", value: "ALL" },
              ...EXPENSE_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
            ]}
          />
        </Space>
      </Card>

      <DataGrid
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
