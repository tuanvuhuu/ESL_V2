"use client";

import { Button, Descriptions, Divider, Tag } from "@/client/primer-compat";
import { PrimerModal } from "@/components/PrimerModal";
import { formatCurrency, paymentOption } from "@/lib/finance";
import { formatDateVN } from "@/lib/dates";

export type ReceiptData = {
  id: number;
  code: string;
  amount: number;
  date: string;
  method: string;
  status: string;
  note?: string | null;
  createdBy: string;
  student: { id: number; fullName: string; code: string; englishName?: string | null };
  center: { id: number; name: string; address?: string | null; code: string; color: string };
  enrollment?: { class?: { name: string; code: string } | null } | null;
};

export function ReceiptModal({
  receipt,
  open,
  onClose,
}: {
  receipt: ReceiptData | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const methodOpt = paymentOption(receipt.method);

  return (
    <PrimerModal
      open={open}
      onClose={onClose}
      width="xlarge"
      title="Phiếu thu học phí"
      subtitle="Biên lai chứng từ thu tiền học phí của học sinh"
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button onClick={onClose}>Đóng</Button>
          <Button type="primary" onClick={handlePrint}>
            In phiếu thu
          </Button>
        </div>
      }
    >
      <div id="printable-receipt" style={{ padding: "16px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0", color: receipt.center.color }}>{receipt.center.name}</h2>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>{receipt.center.address || "Hệ thống Anh ngữ ESL"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fgColor-default)" }}>{receipt.code}</div>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 12 }}>Ngày: {formatDateVN(receipt.date)}</div>
            {receipt.status === "CANCELLED" && (
              <Tag color="red" style={{ marginTop: 4 }}>
                ĐÃ HỦY
              </Tag>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center", margin: "24px 0 16px 0" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
            PHIẾU THU HỌC PHÍ
          </h1>
        </div>

        <Divider style={{ margin: "16px 0" }} />

        <Descriptions column={2} size="middle" bordered={false}>
          <Descriptions.Item label="Học sinh">
            <strong>{receipt.student.fullName}</strong> {receipt.student.englishName ? `(${receipt.student.englishName})` : ""}
          </Descriptions.Item>
          <Descriptions.Item label="Mã học sinh">
            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{receipt.student.code}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Lớp học">
            {receipt.enrollment?.class ? `${receipt.enrollment.class.name} (${receipt.enrollment.class.code})` : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Hình thức">
            <Tag color={methodOpt?.color}>{methodOpt?.label ?? receipt.method}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Số tiền thu" span={2}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--fgColor-success)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(receipt.amount)}
            </span>
          </Descriptions.Item>
          {receipt.note && (
            <Descriptions.Item label="Ghi chú" span={2}>
              {receipt.note}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider style={{ margin: "24px 0 32px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 48 }}>Người nộp tiền</div>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 12 }}>(Ký và ghi rõ họ tên)</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 48 }}>Người lập phiếu</div>
            <div style={{ fontWeight: 600, color: "var(--fgColor-default)" }}>{receipt.createdBy}</div>
          </div>
        </div>
      </div>
    </PrimerModal>
  );
}
