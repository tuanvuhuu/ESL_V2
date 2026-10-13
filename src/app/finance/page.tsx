"use client";

import { useEffect, useState } from "react";
import { PlusOutlined, PrinterOutlined, StopOutlined } from "@/client/primer-icons";
import { Button, Card, Col, DatePicker, Input, Modal, Row, Select, Tag, message } from "@/client/primer-compat";
import dayjs from "dayjs";
import { api, qs } from "@/client/api";
import { PrimerGrid } from "@/components/PrimerGrid";
import { useCenters } from "@/client/centers";
import { useSession } from "@/client/session";
import { ActionMenu, DotLabel, PageHeader } from "@/components/ui";
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
          <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
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
        <DotLabel color={row.center.color}>{row.center.name}</DotLabel>
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
            color: row.status === "VALID" ? "var(--fgColor-success)" : "var(--fgColor-muted)",
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
      width: 48,
      render: (_: any, row: any) => (
        <ActionMenu
          title={`Phiếu thu #${row.id}`}
          items={[
            {
              key: "print",
              label: "In phiếu thu",
              onClick: () => setSelectedReceipt(row),
            },
            ...(row.status === "VALID"
              ? [
                  {
                    key: "cancel",
                    danger: true,
                    label: "Hủy phiếu thu",
                    onClick: () => setCancelModal({ open: true, paymentId: row.id }),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý thu học phí"
        description="Lập, in và theo dõi phiếu thu học phí của học sinh các trung tâm"
        actions={
          <div className="grid-toolbar" style={{ margin: 0 }}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 150 }}
              popupMatchSelectWidth={false}
              options={[
                { label: "Hợp lệ", value: "VALID" },
                { label: "Đã hủy", value: "CANCELLED" },
                { label: "Tất cả", value: "ALL" },
              ]}
            />
          </div>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Tổng thực thu ({payments.filter(p => p.status === "VALID").length} phiếu)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fgColor-success)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(totalAmount)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Thu tiền mặt</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-attention)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(cashAmount)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Thu chuyển khoản</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-accent)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(transferAmount)}
            </div>
          </Card>
        </Col>
      </Row>

      <div>
        <PrimerGrid
          dataSource={payments}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
        />
      </div>

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
        <p style={{ color: "var(--fgColor-danger)" }}>
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
    </>
  );
}
