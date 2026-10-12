"use client";

import { useState } from "react";
import { Form, Input, InputNumber, Modal, Radio, message } from "antd";
import { api } from "@/client/api";
import { ADJUSTMENT_TYPES } from "@/lib/payroll";

export function AdjustmentModal({
  open,
  payrollPeriodId,
  teacherName,
  onClose,
  onSuccess,
}: {
  open: boolean;
  payrollPeriodId: number | null;
  teacherName?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: any) => {
    if (!payrollPeriodId) return;
    setLoading(true);
    try {
      await api.post(`/api/payroll/${payrollPeriodId}/adjustments`, {
        type: values.type,
        amount: values.amount,
        note: values.note,
      });
      message.success("Đã thêm khoản điều chỉnh");
      form.resetFields();
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || "Không thể thêm điều chỉnh");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Thêm điều chỉnh lương - ${teacherName || ""}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Lưu điều chỉnh"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: "BONUS" }}
        onFinish={handleFinish}
      >
        <Form.Item label="Loại điều chỉnh" name="type" rules={[{ required: true }]}>
          <Radio.Group options={ADJUSTMENT_TYPES.map((t) => ({ label: t.label, value: t.value }))} />
        </Form.Item>

        <Form.Item
          label="Số tiền (₫)"
          name="amount"
          rules={[
            { required: true, message: "Vui lòng nhập số tiền" },
            { type: "number", min: 1000, message: "Tối thiểu 1.000 ₫" },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            parser={(val) => (val ? Number(val.replace(/\./g, "")) : 0)}
            size="large"
            placeholder="Nhập số tiền..."
          />
        </Form.Item>

        <Form.Item
          label="Lý do / Diễn giải"
          name="note"
          rules={[{ required: true, message: "Vui lòng nhập lý do điều chỉnh" }]}
        >
          <Input.TextArea rows={2} placeholder="Thưởng chuyên cần, phụ cấp trách nhiệm, trừ đi muộn..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
