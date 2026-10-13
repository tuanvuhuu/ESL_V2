"use client";

import { useEffect, useState } from "react";
import { DollarOutlined, ExclamationCircleOutlined, SearchOutlined } from "@/client/primer-icons";
import { Button, Card, Col, Input, Row, Select, Tag, message } from "@/client/primer-compat";
import { api, qs, useDebounced } from "@/client/api";
import { PrimerGrid } from "@/components/PrimerGrid";
import { useCenters } from "@/client/centers";
import { DotLabel, PageHeader } from "@/components/ui";
import { PaymentModal, type PaymentTarget } from "@/components/finance/PaymentModal";
import { ReceiptModal, type ReceiptData } from "@/components/finance/ReceiptModal";
import { DEBT_STATUSES, debtStatusOption, formatCurrency, type DebtStatus } from "@/lib/finance";
import { formatDateVN } from "@/lib/dates";

export default function DebtsPage() {
  const { centers, centerId } = useCenters();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: any[]; summary: any }>({
    items: [],
    summary: { totalCount: 0, totalFee: 0, totalPaid: 0, totalDebt: 0, overdueCount: 0 },
  });
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const loadDebts = async () => {
    setLoading(true);
    try {
      const query = qs({
        centerId: centerId || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      });
      const res = await api.get<any>(`/api/finance/debts${query}`);
      setData(res);
    } catch (err: any) {
      message.error(err.message || "Không thể tải danh sách công nợ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebts();
  }, [centerId, statusFilter, debouncedSearch]);

  const columns = [
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
      render: (_: any, row: any) => (
        <div>
          <div>{row.class.name}</div>
          <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>{row.class.code}</div>
        </div>
      ),
    },
    {
      title: "Trung tâm",
      key: "center",
      render: (_: any, row: any) => <DotLabel color={row.center.color}>{row.center.name}</DotLabel>,
    },
    {
      title: "Học phí",
      dataIndex: "finalFee",
      key: "finalFee",
      align: "right" as const,
      render: (val: number) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(val)}</span>
      ),
    },
    {
      title: "Đã đóng",
      dataIndex: "paidAmount",
      key: "paidAmount",
      align: "right" as const,
      render: (val: number) => (
        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--fgColor-success)" }}>
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      title: "Còn nợ",
      dataIndex: "debtAmount",
      key: "debtAmount",
      align: "right" as const,
      render: (val: number, row: any) => (
        <span
          style={{
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: row.isOverdue ? "var(--fgColor-danger)" : val > 0 ? "var(--fgColor-attention)" : "var(--fgColor-success)",
          }}
        >
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      title: "Hạn đóng",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date?: string | null) => (date ? formatDateVN(date) : "—"),
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (_: any, row: any) => {
        const opt = debtStatusOption(row.status);
        return (
          <Tag color={opt?.color}>
            {opt?.label ?? row.status}
            {row.isOverdue ? ` (${row.overdueDays} ngày)` : ""}
          </Tag>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "center" as const,
      render: (_: any, row: any) =>
        row.debtAmount > 0 ? (
          <Button
            type="primary"
            size="small"
            icon={<DollarOutlined />}
            onClick={() =>
              setPaymentTarget({
                enrollmentId: row.enrollmentId,
                studentName: row.student.fullName,
                studentCode: row.student.code,
                className: row.class.name,
                debtAmount: row.debtAmount,
                finalFee: row.finalFee,
                paidAmount: row.paidAmount,
              })
            }
          >
            Thu tiền
          </Button>
        ) : (
          <span style={{ color: "var(--fgColor-success)", fontSize: 13 }}>✓ Đã hoàn tất</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sổ theo dõi công nợ học sinh"
        description="Tự động tính công nợ từ học phí thỏa thuận và các phiếu thu, cảnh báo học sinh quá hạn đóng tiền"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Tổng học phí</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-default)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(data.summary.totalFee)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Đã thu</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-success)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(data.summary.totalPaid)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Còn phải thu (Nợ)</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-attention)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(data.summary.totalDebt)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8, borderColor: data.summary.overdueCount > 0 ? "var(--borderColor-danger-emphasis)" : undefined }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Học sinh quá hạn</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-danger)", fontVariantNumeric: "tabular-nums" }}>
              {data.summary.overdueCount} học sinh
            </div>
          </Card>
        </Col>
      </Row>

      <div className="grid-toolbar">
        <Input
          placeholder="Tìm tên, mã học sinh hoặc lớp..."
          prefix={<SearchOutlined style={{ color: "var(--fgColor-muted)" }} />}
          style={{ width: 260 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 170 }}
          popupMatchSelectWidth={false}
          options={[
            { label: "Tất cả trạng thái", value: "ALL" },
            { label: "Quá hạn", value: "OVERDUE" },
            { label: "Đang nợ một phần", value: "PARTIAL" },
            { label: "Chưa đóng", value: "UNPAID" },
            { label: "Đã hoàn tất", value: "PAID" },
          ]}
        />
      </div>

      <div>
        <PrimerGrid
          dataSource={data.items}
          columns={columns}
          rowKey="enrollmentId"
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
        />
      </div>

      <PaymentModal
        open={paymentTarget != null}
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onSuccess={(p) => {
          loadDebts();
          setReceipt(p);
        }}
      />

      <ReceiptModal
        open={receipt != null}
        receipt={receipt}
        onClose={() => setReceipt(null)}
      />
    </>
  );
}
