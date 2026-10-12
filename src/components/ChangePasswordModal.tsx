"use client";

import { App, Form, Input } from "@/client/primer-compat";
import { useState } from "react";
import { api } from "@/client/api";
import { PrimerModal } from "@/components/PrimerModal";

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api("/api/auth/me", { method: "PUT", body: { current: v.current, next: v.next } });
      message.success("Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.");
      form.resetFields();
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PrimerModal
      open={open}
      title="Đổi mật khẩu"
      subtitle="Cập nhật mật khẩu bảo mật cho tài khoản của bạn"
      onClose={onClose}
      onOk={submit}
      okText="Lưu mật khẩu"
      cancelText="Hủy"
      confirmLoading={saving}
      width="large"
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="current" label="Mật khẩu hiện tại" rules={[{ required: true, message: "Nhập mật khẩu hiện tại" }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="next" label="Mật khẩu mới" rules={[{ required: true, min: 8, message: "Tối thiểu 8 ký tự" }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="Nhập lại mật khẩu mới"
          dependencies={["next"]}
          rules={[
            { required: true, message: "Nhập lại mật khẩu mới" },
            ({ getFieldValue }) => ({
              validator: (_, v) => (!v || v === getFieldValue("next") ? Promise.resolve() : Promise.reject(new Error("Hai mật khẩu chưa khớp"))),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </PrimerModal>
  );
}
