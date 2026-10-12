"use client";

import { useEffect, useState } from "react";
import { PlusOutlined, PrinterOutlined, StopOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Dropdown, Input, Modal, Row, Select, Space, Table, Tag, message } from "antd";
import dayjs from "dayjs";
import { api, qs } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useSession } from "@/client/session";
import { PaymentModal } from "@/components/finance/PaymentModal";
import { ReceiptModal, type ReceiptData } from "@/components/finance/ReceiptModal";
import { formatCurrency, paymentOption } from "@/lib/finance";
import { formatDateVN } from "@/lib/dates";

export default function FinancePage() {
  const { centers, centerId } = useCenters();
  const { viewer } = useSession();

  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("VALID");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [cancelModal, setCancelModal] = useState<{ open: boolean; paymentId: number | null }>({
    open: false,
    paymentId: null,
  });
  const [cancelReason, setCancelReason] = useState("");

  const loadPayments = async () => {
    setLoading(true);
    try {
      const query = qs({
        centerId: centerId || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });
      const data = await api.get<any[]>(`/api/finance/payments${query}`);
      setPayments(data);
    } catch (err: any) {
      message.error(err.message || "Không thể tải danh sách phiếu thu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [centerId, statusFilter]);

  const handleCancelPayment = async () => {
    if (!cancelModal.paymentId || !cancelReason.trim()) {
      message.warning("Vui lòng nhập lý do hủy phiếu thu");
      return;
    }
    try {
      await api.post(`/api/finance/payments/${cancelModal.paymentId}/cancel`, {
        reason: cancelReason.trim(),
      });
      message.success("Đã hủy phiếu thu thành công");
      setCancelModal({ open: false, paymentId: null });
      setCancelReason("");
      loadPayments();
    } catch (err: any) {
      message.error(err.message || "Không thể hủy phiếu thu");
    }
  };

  // Thống kê nhanh
  const totalAmount = payments.filter((p) => p.status === "VALID").reduce((s, p) => s + p.amount, 0);
  const cashAmount = payments
    .filter((p) => p.status === "VALID" && p.method === "CASH")
    .reduce((s, p) => s + p.amount, 0);
  const transferAmount = payments
    .filter((p) => p.status === "VALID" && p.method === "TRANSFER")
    .reduce((s, p) => s + p.amount, 0);

  const columns = [
    {
      title: "Mã phiếu",
      dataIndex: "code",
      key: "code",
      render: (code: string, row: any) => (
        <a
          onClick={() => setSelectedReceipt(row)}
          style={{ fontWeight: 600, fontFamily: "monospace" }}
        >
          {code}
        </a>
      ),
    },
    {
      title: "Ngày thu",
      dataIndex: "date",
      key: "date",
      render: (date: string) => formatDateVN(date),
    },
    {
      title: "Học sinh",
      key: "student",
      render: (_: any, row: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.student.fullName}</div>
          <div style={{ fontSize: 12, color: "#8C959F" }}>
            {row.student.code} {row.student.englishName ? `· ${row.student.englishName}` : ""}
          </div>
        </div>
      ),
    },
    {
      title: "Lớp học",
      key: "class",
      render: (_: any, row: any) => row.enrollment?.class?.name || "—",
    },
    {
      title: "Trung tâm",
      dataIndex: ["center", "name"],
      key: "center",
      render: (_: any, row: any) => (
        <Tag color={row.center.color}>{row.center.name}</Tag>
      ),
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      key: "amount",
      align: "right" as const,
      render: (val: number, row: any) => (
        <span
          style={{
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: row.status === "VALID" ? "#2DA44E" : "#8C959F",
            textDecoration: row.status === "CANCELLED" ? "line-through" : "none",
          }}
        >
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      title: "Phương thức",
      dataIndex: "method",
      key: "method",
      render: (method: string) => {
        const opt = paymentOption(method);
        return <Tag color={opt?.color}>{opt?.label ?? method}</Tag>;
      },
    },
    {
      title: "Người thu",
      dataIndex: "createdBy",
      key: "createdBy",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (st: string) =>
        st === "VALID" ? (
          <Tag color="success">Hợp lệ</Tag>
        ) : (
          <Tag color="error">Đã hủy</Tag>
        ),
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "center" as const,
      render: (_: any, row: any) => (
        <Dropdown
          menu={{
            items: [
              {
                key: "print",
                icon: <PrinterOutlined />,
                label: "In phiếu thu",
                onClick: () => setSelectedReceipt(row),
              },
              ...(row.status === "VALID"
                ? [
                    {
                      key: "cancel",
                      icon: <StopOutlined />,
                      danger: true,
                      label: "Hủy phiếu thu",
                      onClick: () => setCancelModal({ open: true, paymentId: row.id }),
                    },
                  ]
                : []),
            ],
          }}
        >
          <Button size="small">⋯</Button>
        </Dropdown>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px 0" }}>Quản lý thu học phí</h1>
          <div style={{ color: "#59636E" }}>Lập, in và theo dõi phiếu thu học phí của học sinh các trung tâm</div>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "#59636E", fontSize: 13 }}>Tổng thực thu ({payments.filter(p => p.status === "VALID").length} phiếu)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#2DA44E", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(totalAmount)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "#59636E", fontSize: 13 }}>Thu tiền mặt</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#D29922", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(cashAmount)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "#59636E", fontSize: 13 }}>Thu chuyển khoản</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1F6FEB", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(transferAmount)}
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>Trạng thái:</span>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { label: "Hợp lệ", value: "VALID" },
              { label: "Đã hủy", value: "CANCELLED" },
              { label: "Tất cả", value: "ALL" },
            ]}
          />
        </Space>
      </Card>

      <Table
        dataSource={payments}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
      />

      <ReceiptModal
        open={selectedReceipt != null}
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />

      <Modal
        open={cancelModal.open}
        title="Xác nhận hủy phiếu thu"
        onCancel={() => {
          setCancelModal({ open: false, paymentId: null });
          setCancelReason("");
        }}
        onOk={handleCancelPayment}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: "#CF222E" }}>
          Lưu ý: Phiếu thu đã hủy sẽ không được xóa khỏi hệ thống để đảm bảo tính minh bạch kiểm toán.
        </p>
        <div style={{ marginBottom: 8 }}>Vui lòng nhập lý do hủy phiếu thu:</div>
        <Input.TextArea
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Nhập nhầm số tiền, học sinh đổi ý..."
        />
      </Modal>
    </div>
  );
}
