"use client";

import { useEffect, useState } from "react";
import { DatePicker, Form, Input, InputNumber, Radio, message } from "@/client/primer-compat";
import dayjs from "dayjs";
import { api } from "@/client/api";
import { PrimerModal } from "@/components/PrimerModal";
import { OVERLAP_POLICIES } from "@/lib/payroll";
import { formatDateVN } from "@/lib/dates";

type HistoryRow = { id: number; effectiveDate: string; overlapPolicy: string; overlapRatio: number | null; note: string | null };

/** B4: đổi cách tính lương khi trùng giờ, có ngày hiệu lực. Tháng đã chốt giữ nguyên cách cũ. */
export function OverlapModal({
  open,
  teacherId,
  teacherName,
  onClose,
  onSuccess,
}: {
  open: boolean;
  teacherId: number | null;
  teacherName?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const policy = Form.useWatch("overlapPolicy", form);

  useEffect(() => {
    if (!open || !teacherId) return;
    form.resetFields();
    form.setFieldsValue({ overlapPolicy: "SINGLE", overlapRatio: 1.5, effectiveDate: dayjs() });
    api.get<HistoryRow[]>(`/api/payroll/overlap?teacherId=${teacherId}`).then(setHistory).catch(() => setHistory([]));
  }, [open, teacherId, form]);

  const handleFinish = async (values: any) => {
    if (!teacherId) return;
    setLoading(true);
    try {
      await api.put("/api/payroll/overlap", {
        teacherId,
        overlapPolicy: values.overlapPolicy,
        overlapRatio: values.overlapPolicy === "RATIO" ? values.overlapRatio : undefined,
        effectiveDate: values.effectiveDate.format("YYYY-MM-DD"),
        note: values.note || undefined,
      });
      message.success("Đã lưu cách tính trùng giờ");
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || "Không thể lưu");
    } finally {
      setLoading(false);
    }
  };

  const labelOf = (v: string) => OVERLAP_POLICIES.find((o) => o.value === v)?.label ?? v;

  return (
    <PrimerModal
      open={open}
      title={`Cách tính trùng giờ - ${teacherName || ""}`}
      subtitle="Buổi dạy trước ngày hiệu lực giữ cách cũ; tháng đã chốt lương không bị đổi"
      onClose={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Lưu"
      width="large"
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item label="Cách tính" name="overlapPolicy" rules={[{ required: true }]}>
          <Radio.Group options={OVERLAP_POLICIES.map((o) => ({ label: o.label, value: o.value }))} />
        </Form.Item>
        {policy === "RATIO" && (
          <Form.Item label="Hệ số" name="overlapRatio" rules={[{ required: true, message: "Nhập hệ số" }]}>
            <InputNumber min={0.1} max={5} step={0.1} style={{ width: "100%" }} />
          </Form.Item>
        )}
        <Form.Item label="Ngày bắt đầu hiệu lực" name="effectiveDate" rules={[{ required: true, message: "Chọn ngày hiệu lực" }]}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item label="Ghi chú" name="note">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
      {history.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Lịch sử</div>
          {history.map((h) => (
            <div key={h.id}>
              {h.effectiveDate.startsWith("0000") ? "Từ đầu" : formatDateVN(h.effectiveDate)}: {labelOf(h.overlapPolicy)}
              {h.overlapPolicy === "RATIO" && h.overlapRatio ? ` (×${h.overlapRatio})` : ""}
            </div>
          ))}
        </div>
      )}
    </PrimerModal>
  );
}
