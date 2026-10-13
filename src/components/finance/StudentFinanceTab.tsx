"use client";

import { useEffect, useState } from "react";
import { DollarOutlined, PlusOutlined, PrinterOutlined, RollbackOutlined } from "@/client/primer-icons";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Space, Table, Tag, message } from "@/client/primer-compat";
import { api } from "@/client/api";
import { useSession } from "@/client/session";
import { PaymentModal, type PaymentTarget } from "./PaymentModal";
import { ReceiptModal, type ReceiptData } from "./ReceiptModal";
import { computeDebtStatus, formatCurrency, paymentOption } from "@/lib/finance";
import { canManageFinance, isManager } from "@/lib/permissions";
import { RenewModal, type RenewTarget } from "./RenewModal";
import { formatDateVN, todayISO } from "@/lib/dates";

export function StudentFinanceTab({
  studentId,
  studentName,
  studentCode,
  enrollments,
  onChanged,
}: {
  studentId: number;
  studentName: string;
  studentCode: string;
  enrollments: any[];
  /** Tải lại hồ sơ sau khi đổi học phí / số buổi (mua thêm buổi). */
  onChanged?: () => void;
}) {
  const { viewer } = useSession();
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [renewTarget, setRenewTarget] = useState<RenewTarget | null>(null);

  // Refund modal state
  const [refundTarget, setRefundTarget] = useState<{
    enrollmentId: number;
    className: string;
    maxRefund: number;
  } | null>(null);
  const [refundForm] = Form.useForm();
  const [refundLoading, setRefundLoading] = useState(false);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/api/finance/payments?studentId=${studentId}`);
      setPayments(data);
    } catch (err: any) {
      message.error(err.message || "Không thể tải phiếu thu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [studentId]);

  const today = todayISO();

  // Tính công nợ theo từng khóa học của học sinh
  const enrollmentCards = enrollments.map((e) => {
    const standardFee = e.class?.course?.tuition ?? 0;
    const finalFee = e.tuitionFee ?? standardFee;
    const classPayments = payments.filter((p) => p.enrollmentId === e.id && p.status === "VALID");
    const paidAmount = classPayments.reduce((s, p) => s + p.amount, 0);

    const debt = computeDebtStatus({
      finalFee,
      paidAmount,
      dueDate: e.dueDate,
      today,
    });

    return {
      enrollmentId: e.id,
      classId: e.classId as number,
      centerId: e.class?.centerId as number,
      active: !e.leftAt,
      purchasedSessions: (e.purchasedSessions ?? e.class?.totalSessions ?? 0) as number,
      className: e.class?.name ?? "Lớp học",
      classCode: e.class?.code ?? "",
      finalFee,
      paidAmount,
      debtAmount: debt.debtAmount,
      status: debt.status,
      isOverdue: debt.isOverdue,
      overdueDays: debt.overdueDays,
    };
  });

  const totalFee = enrollmentCards.reduce((s, e) => s + e.finalFee, 0);
  const totalPaid = enrollmentCards.reduce((s, e) => s + e.paidAmount, 0);
  const totalDebt = enrollmentCards.reduce((s, e) => s + e.debtAmount, 0);

  const handleRefund = async (values: any) => {
    if (!refundTarget) return;
    setRefundLoading(true);
    try {
      await api.post("/api/finance/refunds", {
        enrollmentId: refundTarget.enrollmentId,
        amount: values.amount,
        date: today,
        reason: values.reason,
      });
      message.success("Đã hoàn tiền học phí thành công");
      setRefundTarget(null);
      refundForm.resetFields();
      loadPayments();
    } catch (err: any) {
      message.error(err.message || "Không thể thực hiện hoàn tiền");
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Tổng học phí các khóa</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fgColor-default)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(totalFee)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Đã đóng</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fgColor-success)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(totalPaid)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Còn nợ</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: totalDebt > 0 ? "var(--fgColor-danger)" : "var(--fgColor-success)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCurrency(totalDebt)}
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Tình trạng học phí theo lớp" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Table
          dataSource={enrollmentCards}
          rowKey="enrollmentId"
          pagination={false}
          columns={[
            {
              title: "Lớp học",
              render: (_: any, r: any) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.className}</div>
                  <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>{r.classCode}</div>
                </div>
              ),
            },
            {
              title: "Học phí",
              dataIndex: "finalFee",
              align: "right" as const,
              render: (v: number) => formatCurrency(v),
            },
            {
              title: "Đã đóng",
              dataIndex: "paidAmount",
              align: "right" as const,
              render: (v: number) => <span style={{ color: "var(--fgColor-success)" }}>{formatCurrency(v)}</span>,
            },
            {
              title: "Còn nợ",
              dataIndex: "debtAmount",
              align: "right" as const,
              render: (v: number, r: any) => (
                <span
                  style={{
                    fontWeight: 700,
                    color: r.isOverdue ? "var(--fgColor-danger)" : v > 0 ? "var(--fgColor-attention)" : "var(--fgColor-success)",
                  }}
                >
                  {formatCurrency(v)}
                </span>
              ),
            },
            {
              title: "Trạng thái",
              render: (_: any, r: any) => (
                <Tag color={r.status === "PAID" ? "green" : r.isOverdue ? "red" : "orange"}>
                  {r.status === "PAID" ? "Đã xong" : r.isOverdue ? `Quá hạn (${r.overdueDays} ngày)` : "Đang nợ"}
                </Tag>
              ),
            },
            {
              title: "Thao tác",
              align: "center" as const,
              render: (_: any, r: any) => (
                <Space>
                  {r.debtAmount > 0 && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<DollarOutlined />}
                      onClick={() =>
                        setPaymentTarget({
                          enrollmentId: r.enrollmentId,
                          studentName,
                          studentCode,
                          className: r.className,
                          debtAmount: r.debtAmount,
                          finalFee: r.finalFee,
                          paidAmount: r.paidAmount,
                        })
                      }
                    >
                      Thu tiền
                    </Button>
                  )}
                  {viewer && r.active && canManageFinance(viewer, r.centerId) && (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        setRenewTarget({
                          classId: r.classId,
                          enrollmentId: r.enrollmentId,
                          className: r.className,
                          finalFee: r.finalFee,
                          purchasedSessions: r.purchasedSessions,
                        })
                      }
                    >
                      Mua thêm buổi
                    </Button>
                  )}
                  {viewer && isManager(viewer) && r.paidAmount > 0 && (
                    <Button
                      size="small"
                      icon={<RollbackOutlined />}
                      onClick={() => {
                        setRefundTarget({
                          enrollmentId: r.enrollmentId,
                          className: r.className,
                          maxRefund: r.paidAmount,
                        });
                        refundForm.setFieldsValue({
                          amount: r.paidAmount,
                          reason: "",
                        });
                      }}
                    >
                      Hoàn tiền
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card size="small" title="Lịch sử các phiếu thu học phí" style={{ borderRadius: 8 }}>
        <Table
          dataSource={payments}
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={[
            {
              title: "Mã phiếu",
              dataIndex: "code",
              render: (code: string, row: any) => (
                <a onClick={() => setReceipt(row)} style={{ fontWeight: 600, fontFamily: "monospace" }}>
                  {code}
                </a>
              ),
            },
            {
              title: "Ngày thu",
              dataIndex: "date",
              render: (d: string) => formatDateVN(d),
            },
            {
              title: "Lớp học",
              render: (_: any, row: any) => row.enrollment?.class?.name || "—",
            },
            {
              title: "Số tiền",
              dataIndex: "amount",
              align: "right" as const,
              render: (v: number, row: any) => (
                <span
                  style={{
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: row.status === "VALID" ? "var(--fgColor-success)" : "var(--fgColor-muted)",
                    textDecoration: row.status === "CANCELLED" ? "line-through" : "none",
                  }}
                >
                  {formatCurrency(v)}
                </span>
              ),
            },
            {
              title: "Hình thức",
              dataIndex: "method",
              render: (m: string) => {
                const opt = paymentOption(m);
                return <Tag color={opt?.color}>{opt?.label ?? m}</Tag>;
              },
            },
            {
              title: "Người thu",
              dataIndex: "createdBy",
            },
            {
              title: "Trạng thái",
              dataIndex: "status",
              render: (st: string) =>
                st === "VALID" ? <Tag color="success">Hợp lệ</Tag> : <Tag color="error">Đã hủy</Tag>,
            },
            {
              title: "In",
              align: "center" as const,
              render: (_: any, row: any) => (
                <Button size="small" icon={<PrinterOutlined />} onClick={() => setReceipt(row)} />
              ),
            },
          ]}
        />
      </Card>

      <PaymentModal
        open={paymentTarget != null}
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onSuccess={(p) => {
          loadPayments();
          setReceipt(p);
        }}
      />

      <RenewModal
        target={renewTarget}
        onClose={() => setRenewTarget(null)}
        onDone={() => {
          setRenewTarget(null);
          onChanged?.();
        }}
      />

      <ReceiptModal
        open={receipt != null}
        receipt={receipt}
        onClose={() => setReceipt(null)}
      />

      {/* Modal Hoàn tiền */}
      <Modal
        open={refundTarget != null}
        title={`Duyệt hoàn tiền - ${refundTarget?.className || ""}`}
        onCancel={() => setRefundTarget(null)}
        onOk={() => refundForm.submit()}
        confirmLoading={refundLoading}
        okText="Xác nhận hoàn tiền"
        destroyOnClose
      >
        <Form form={refundForm} layout="vertical" onFinish={handleRefund}>
          <div style={{ marginBottom: 16 }}>
            Số tiền có thể hoàn tối đa: <strong>{formatCurrency(refundTarget?.maxRefund ?? 0)}</strong>
          </div>
          <Form.Item
            label="Số tiền hoàn (₫)"
            name="amount"
            rules={[
              { required: true, message: "Vui lòng nhập số tiền hoàn" },
              { type: "number", min: 1000, message: "Tối thiểu 1.000 ₫" },
              {
                type: "number",
                max: refundTarget?.maxRefund,
                message: `Tối đa ${formatCurrency(refundTarget?.maxRefund ?? 0)}`,
              },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(val) => (val ? Number(val.replace(/\./g, "")) : 0)}
              size="large"
            />
          </Form.Item>
          <Form.Item
            label="Lý do hoàn tiền"
            name="reason"
            rules={[{ required: true, message: "Vui lòng nhập lý do hoàn tiền" }]}
          >
            <Input.TextArea rows={3} placeholder="Học sinh chuyển nhà, bảo lưu không quay lại..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
