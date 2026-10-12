"use client";

import { App, Form, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import type { Parent } from "@/client/types";
import { isValidPhone } from "@/lib/text";

export function ParentFormModal({
  open,
  parent,
  onClose,
  onSaved,
}: {
  open: boolean;
  parent?: Parent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (parent) form.setFieldsValue(parent);
  }, [open, parent, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const saved = parent
        ? await api<Parent>(`/api/parents/${parent.id}`, { method: "PUT", body: v })
        : await api<Parent>("/api/parents", { body: v });
      message.success(parent ? `Đã cập nhật ${saved.fullName}` : `Đã thêm ${saved.fullName}`);
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
      title={parent ? `Sửa phụ huynh · ${parent.fullName}` : "Thêm phụ huynh"}
      onCancel={onClose}
      onOk={submit}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, whitespace: true, message: "Nhập họ tên" }]}>
          <Input autoFocus />
        </Form.Item>
        <Form.Item
          name="phone"
          label="SĐT"
          rules={[
            { required: true, message: "Nhập SĐT" },
            { validator: (_, v) => (!v || isValidPhone(v) ? Promise.resolve() : Promise.reject(new Error("SĐT gồm 10 số, bắt đầu bằng 0"))) },
          ]}
        >
          <Input inputMode="tel" />
        </Form.Item>
        <Form.Item name="zalo" label="Zalo">
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email">
          <Input type="email" />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
