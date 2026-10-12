"use client";

import { useState } from "react";
import { DatePicker, Form, Input, InputNumber, Modal, Select, message } from "antd";
import dayjs from "dayjs";
import { api } from "@/client/api";
import { useCenters } from "@/client/centers";

export const EXPENSE_CATEGORIES = [
  { value: "RENT", label: "Mặt bằng", color: "#1F6FEB" },
  { value: "UTILITIES", label: "Điện nước / Internet", color: "#0E7490" },
  { value: "MARKETING", label: "Marketing / Tuyển sinh", color: "#8250DF" },
  { value: "MATERIALS", label: "Giáo trình & Học liệu", color: "#2DA44E" },
  { value: "OTHER", label: "Chi phí khác", color: "#8C959F" },
] as const;

export function ExpenseModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { centers, centerId } = useCenters();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      await api.post("/api/finance/expenses", {
        centerId: values.centerId,
        category: values.category,
        amount: values.amount,
        date: values.date.format("YYYY-MM-DD"),
        payer: values.payer,
        note: values.note,
      });
      message.success("Đã ghi nhận chi phí thành công");
      form.resetFields();
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || "Không thể lưu chi phí");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Ghi nhận chi phí hoạt động"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Lưu chi phí"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          centerId: (centerId || centers[0]?.id) ?? undefined,
          category: "RENT",
          date: dayjs(),
        }}
        onFinish={handleFinish}
      >
        <Form.Item
          label="Trung tâm"
          name="centerId"
          rules={[{ required: true, message: "Vui lòng chọn trung tâm" }]}
        >
          <Select
            options={centers.map((c) => ({ label: c.name, value: c.id }))}
            placeholder="Chọn trung tâm"
          />
        </Form.Item>

        <Form.Item
          label="Khoản mục chi phí"
          name="category"
          rules={[{ required: true, message: "Vui lòng chọn loại chi phí" }]}
        >
          <Select options={EXPENSE_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))} />
        </Form.Item>

        <Form.Item
          label="Số tiền (₫)"
          name="amount"
          rules={[
            { required: true, message: "Vui lòng nhập số tiền chi" },
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
          label="Ngày chi"
          name="date"
          rules={[{ required: true, message: "Vui lòng chọn ngày" }]}
        >
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item
          label="Người thực hiện chi"
          name="payer"
          rules={[{ required: true, message: "Vui lòng nhập tên người chi" }]}
        >
          <Input placeholder="Tên giáo vụ hoặc người phụ trách chi..." />
        </Form.Item>

        <Form.Item label="Ghi chú / Chi tiết" name="note">
          <Input.TextArea rows={2} placeholder="Hóa đơn tiền điện tháng 10, mua sách mới..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
