"use client";

import { App, DatePicker, Form, Input, Modal, Radio, Select } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { CONTACT_CHANNELS } from "@/lib/constants";
import { formatPhone } from "@/lib/text";

export type ContactTarget = {
  studentId: number;
  studentName: string;
  parents: { id: number; fullName: string; phone: string; relation?: string }[];
  /** Ghi kết quả cho việc cần gọi lại này (đóng việc đó). */
  followUp?: { id: number; note: string | null };
};

/** Ghi một lần liên lạc với phụ huynh, có thể hẹn ngày gọi lại (M7). */
export function ContactModal({ target, onClose, onSaved }: { target: ContactTarget | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    form.resetFields();
    form.setFieldsValue({ channel: "CALL", parentId: target.parents[0]?.id });
  }, [target, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api("/api/contacts", {
        body: {
          studentId: target!.studentId,
          parentId: v.parentId ?? null,
          channel: v.channel,
          content: v.content,
          followUpDate: v.followUpDate ? (v.followUpDate as Dayjs).format("YYYY-MM-DD") : null,
          followUpNote: v.followUpNote ?? null,
          closeId: target!.followUp?.id ?? null,
        },
      });
      message.success(v.followUpDate ? `Đã ghi, hẹn gọi lại ${(v.followUpDate as Dayjs).format("DD/MM")}` : "Đã ghi liên lạc");
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!target}
      title={target ? `${target.followUp ? "Ghi kết quả gọi lại" : "Ghi liên lạc"} · ${target.studentName}` : ""}
      okText="Lưu"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      destroyOnHidden
    >
      {target?.followUp?.note && <div className="sub" style={{ marginBottom: 12 }}>Việc cần làm: {target.followUp.note}</div>}
      <Form form={form} layout="vertical">
        <Form.Item name="channel" label="Cách liên lạc" rules={[{ required: true }]}>
          <Radio.Group optionType="button" options={CONTACT_CHANNELS.map((c) => ({ value: c.value, label: c.label }))} />
        </Form.Item>
        {target && target.parents.length > 0 && (
          <Form.Item name="parentId" label="Người liên hệ">
            <Select
              allowClear
              options={target.parents.map((p) => ({ value: p.id, label: `${p.fullName}${p.relation ? ` (${p.relation})` : ""} · ${formatPhone(p.phone)}` }))}
            />
          </Form.Item>
        )}
        <Form.Item name="content" label="Nội dung trao đổi" rules={[{ required: true, message: "Ghi nội dung trao đổi" }]}>
          <Input.TextArea rows={3} maxLength={1000} placeholder="VD: Mẹ báo tuần sau con ốm nghỉ 2 buổi, xin học bù" />
        </Form.Item>
        <Form.Item name="followUpDate" label="Hẹn gọi lại" extra="Bỏ trống nếu không cần gọi lại. Có ngày hẹn thì vào trang Cần gọi lại.">
          <DatePicker format="DD/MM/YYYY" style={{ width: 180 }} disabledDate={(d) => d.isBefore(dayjs(), "day")} />
        </Form.Item>
        <Form.Item
          name="followUpNote"
          label="Việc cần làm khi gọi lại"
          dependencies={["followUpDate"]}
          rules={[({ getFieldValue }) => ({ required: !!getFieldValue("followUpDate"), message: "Ghi việc cần làm khi gọi lại" })]}
        >
          <Input maxLength={200} placeholder="VD: Hỏi lại lịch học bù, tư vấn khóa Kids 2" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
