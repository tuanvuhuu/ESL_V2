"use client";

import { useEffect, useState } from "react";
import { Alert, DatePicker, Form, Input, InputNumber, Radio, Select, message } from "@/client/primer-compat";
import dayjs from "dayjs";
import { api } from "@/client/api";
import { PrimerModal } from "@/components/PrimerModal";
import { formatCurrency, PAYMENT_METHODS } from "@/lib/finance";
import { todayISO } from "@/lib/dates";

export type PaymentTarget = {
  enrollmentId: number;
  studentName: string;
  studentCode: string;
  className: string;
  debtAmount: number;
  finalFee: number;
  paidAmount: number;
};

export function PaymentModal({
  open,
  target,
  onClose,
  onSuccess,
}: {
  open: boolean;
  target?: PaymentTarget | null;
  onClose: () => void;
  onSuccess: (payment: any) => void;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && target) {
      form.setFieldsValue({
        enrollmentId: target.enrollmentId,
        amount: target.debtAmount > 0 ? target.debtAmount : target.finalFee,
        date: dayjs(),
        method: "CASH",
        note: "",
      });
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({
        date: dayjs(),
        method: "CASH",
      });
    }
  }, [open, target, form]);

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        enrollmentId: values.enrollmentId,
        amount: values.amount,
        date: values.date.format("YYYY-MM-DD"),
        method: values.method,
        note: values.note,
      };
      const res = await api.post<any>("/api/finance/payments", payload);
      message.success(`Đã lập phiếu thu ${res.code} thành công`);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      message.error(err.message || "Không thể lập phiếu thu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PrimerModal
      open={open}
      title="Lập phiếu thu học phí"
      subtitle="Ghi nhận khoản thanh toán học phí của học sinh và tạo phiếu thu"
      onClose={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Lưu và in phiếu thu"
      width="large"
    >
      {target && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <div>
              <div>
                Học sinh: <strong>{target.studentName}</strong> ({target.studentCode})
              </div>
              <div>
                Lớp: <strong>{target.className}</strong>
              </div>
              <div style={{ marginTop: 4 }}>
                Học phí: {formatCurrency(target.finalFee)} · Đã đóng: {formatCurrency(target.paidAmount)} · Còn nợ:{" "}
                <strong style={{ color: target.debtAmount > 0 ? "#CF222E" : "#2DA44E" }}>
                  {formatCurrency(target.debtAmount)}
                </strong>
              </div>
            </div>
          }
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item name="enrollmentId" hidden>
          <Input />
        </Form.Item>

        <Form.Item
          label="Số tiền thu (₫)"
          name="amount"
          rules={[
            { required: true, message: "Vui lòng nhập số tiền thu" },
            { type: "number", min: 1000, message: "Số tiền tối thiểu 1.000 ₫" },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            parser={(value) => (value ? Number(value.replace(/\./g, "")) : 0)}
            size="large"
            placeholder="Nhập số tiền..."
          />
        </Form.Item>

        <Form.Item
          label="Ngày thu"
          name="date"
          rules={[{ required: true, message: "Vui lòng chọn ngày thu" }]}
        >
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item label="Phương thức thanh toán" name="method" rules={[{ required: true }]}>
          <Radio.Group options={PAYMENT_METHODS.map((m) => ({ label: m.label, value: m.value }))} />
        </Form.Item>

        <Form.Item label="Ghi chú" name="note">
          <Input.TextArea rows={2} placeholder="Đóng đợt 1, đóng theo chuyển khoản..." />
        </Form.Item>
      </Form>
    </PrimerModal>
  );
}
