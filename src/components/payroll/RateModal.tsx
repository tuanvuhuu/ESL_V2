"use client";

import { useEffect, useState } from "react";
import { DatePicker, Form, Input, InputNumber, Modal, Radio, message } from "antd";
import dayjs from "dayjs";
import { api } from "@/client/api";

export function RateModal({
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

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        role: "TEACHER",
        effectiveDate: dayjs(),
      });
    }
  }, [open, form]);

  const handleFinish = async (values: any) => {
    if (!teacherId) return;
    setLoading(true);
    try {
      await api.post("/api/payroll/rates", {
        teacherId,
        role: values.role,
        hourlyRate: values.hourlyRate,
        effectiveDate: values.effectiveDate.format("YYYY-MM-DD"),
        note: values.note,
      });
      message.success("Đã lưu đơn giá giờ mới");
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || "Không thể lưu đơn giá");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Đặt đơn giá giờ - ${teacherName || ""}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Lưu đơn giá"
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item label="Vai trò áp dụng" name="role" rules={[{ required: true }]}>
          <Radio.Group
            options={[
              { label: "Giáo viên chính", value: "TEACHER" },
              { label: "Trợ giảng", value: "ASSISTANT" },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="Đơn giá một giờ (₫/h)"
          name="hourlyRate"
          rules={[
            { required: true, message: "Vui lòng nhập đơn giá" },
            { type: "number", min: 10000, message: "Tối thiểu 10.000 ₫/h" },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            parser={(val) => (val ? Number(val.replace(/\./g, "")) : 0)}
            size="large"
            placeholder="Ví dụ: 300000"
          />
        </Form.Item>

        <Form.Item
          label="Ngày bắt đầu hiệu lực"
          name="effectiveDate"
          rules={[{ required: true, message: "Vui lòng chọn ngày hiệu lực" }]}
        >
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item label="Ghi chú" name="note">
          <Input.TextArea rows={2} placeholder="Tăng lương theo năm, mức giá thử việc..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
