"use client";

import { App, DatePicker, Form, Input, InputNumber, Modal } from "@/client/primer-compat";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { formatCurrency, sessionPriceOf } from "@/lib/finance";

export type RenewTarget = {
  classId: number;
  enrollmentId: number;
  className: string;
  finalFee: number;
  purchasedSessions: number;
};

const money = {
  formatter: (v: unknown) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
  parser: (v: string | undefined) => Number((v ?? "").replace(/\./g, "")) || 0,
};

/** Mua thêm buổi cho ghi danh đang học: số buổi × đơn giá gói hiện tại (sửa được), hạn đóng mới. */
export function RenewModal({ target, onClose, onDone }: { target: RenewTarget | null; onClose: () => void; onDone: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const price = target ? sessionPriceOf(target.finalFee, target.purchasedSessions) : 0;

  useEffect(() => {
    if (!target) return;
    form.resetFields();
    form.setFieldsValue({ sessions: 8, amount: price * 8 });
  }, [target, form, price]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api(`/api/classes/${target!.classId}/enrollments/${target!.enrollmentId}/renew`, {
        body: { sessions: v.sessions, amount: v.amount ?? 0, dueDate: v.dueDate ? v.dueDate.format("YYYY-MM-DD") : null, note: v.note },
      });
      message.success(`Đã thêm ${v.sessions} buổi. Thu tiền ở nút Thu tiền.`);
      onDone();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!target} title={`Mua thêm buổi · ${target?.className ?? ""}`} onCancel={onClose} onOk={submit} confirmLoading={saving} okText="Thêm buổi" cancelText="Hủy">
      <div className="sub" style={{ marginBottom: 12 }}>
        Gói hiện tại {target?.purchasedSessions} buổi, {formatCurrency(target?.finalFee ?? 0)} (khoảng {formatCurrency(price)}/buổi).
      </div>
      <Form form={form} layout="vertical">
        <Form.Item name="sessions" label="Số buổi mua thêm" rules={[{ required: true, message: "Nhập số buổi" }]}>
          <InputNumber min={1} max={300} onChange={(n) => form.setFieldsValue({ amount: price * (Number(n) || 0) })} />
        </Form.Item>
        <Form.Item name="amount" label="Thành tiền (₫)" rules={[{ required: true, message: "Nhập số tiền" }]}>
          <InputNumber min={0} step={100000} style={{ width: 200 }} formatter={money.formatter} parser={money.parser as never} />
        </Form.Item>
        <Form.Item name="dueDate" label="Hạn đóng">
          <DatePicker format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input placeholder="Gia hạn 8 buổi, giữ giảm giá anh chị em" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
