"use client";

import { App, Checkbox, Form, Input, Modal, Select } from "@/client/primer-compat";
import { useState } from "react";
import { api, qs } from "@/client/api";
import type { Parent } from "@/client/types";
import { RELATIONS } from "@/lib/constants";
import { isValidPhone, normalizePhone } from "@/lib/text";

export function AddGuardianModal({ studentId, open, onClose, onSaved }: { studentId: number; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const phone = normalizePhone(v.phone);
      let parent = await api<Parent | null>(`/api/parents${qs({ phone })}`);
      if (!parent) parent = await api<Parent>("/api/parents", { body: { fullName: v.fullName, phone, zalo: v.zalo } });
      await api(`/api/students/${studentId}/guardians`, {
        body: { parentId: parent.id, relation: v.relation, isPrimary: !!v.isPrimary, isPayer: !!v.isPayer },
      });
      message.success(`Đã thêm phụ huynh ${parent.fullName}`);
      form.resetFields();
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Thêm phụ huynh" onCancel={onClose} onOk={submit} okText="Lưu" cancelText="Hủy" confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" initialValues={{ relation: "Bố" }}>
        <Form.Item
          name="phone"
          label="SĐT"
          extra="Nếu SĐT đã có trong hệ thống, học sinh sẽ được gắn với phụ huynh đó."
          rules={[
            { required: true, message: "Nhập SĐT" },
            { validator: (_, v) => (!v || isValidPhone(v) ? Promise.resolve() : Promise.reject(new Error("SĐT gồm 10 số, bắt đầu bằng 0"))) },
          ]}
        >
          <Input inputMode="tel" autoFocus />
        </Form.Item>
        <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, whitespace: true, message: "Nhập họ tên" }]}>
          <Input />
        </Form.Item>
        <Form.Item name="relation" label="Quan hệ" rules={[{ required: true }]}>
          <Select options={RELATIONS.map((r) => ({ value: r, label: r }))} />
        </Form.Item>
        <Form.Item name="zalo" label="Zalo">
          <Input />
        </Form.Item>
        <Form.Item name="isPrimary" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Người liên hệ chính</Checkbox>
        </Form.Item>
        <Form.Item name="isPayer" valuePropName="checked">
          <Checkbox>Người đóng tiền</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
