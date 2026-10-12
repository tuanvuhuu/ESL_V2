"use client";

import { App, Form, Input, Modal, Select } from "antd";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { QUIT_REASONS, STUDENT_STATUSES } from "@/lib/constants";

type Props = {
  open: boolean;
  student: { id: number; fullName: string; status: string } | null;
  initialStatus?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function StatusModal({ open, student, initialStatus, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const status = Form.useWatch("status", form);

  useEffect(() => {
    if (open && student) form.setFieldsValue({ status: initialStatus ?? student.status, reason: undefined, note: undefined });
  }, [open, student, initialStatus, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api(`/api/students/${student!.id}/status`, { body: v });
      const label = STUDENT_STATUSES.find((s) => s.value === v.status)?.label;
      message.success(`${student!.fullName}: ${label}`);
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      width={440}
      title={`Đổi trạng thái · ${student?.fullName ?? ""}`}
      onCancel={onClose}
      onOk={submit}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="status" label="Trạng thái mới" rules={[{ required: true }]}>
          <Select options={STUDENT_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
        </Form.Item>
        {status === "QUIT" && (
          <Form.Item name="reason" label="Lý do" rules={[{ required: true, message: "Chọn lý do nghỉ" }]}>
            <Select options={QUIT_REASONS.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
        )}
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
        <div className="sub">Thay đổi được lưu vào lịch sử.</div>
      </Form>
    </Modal>
  );
}
