"use client";

import { App, Form, Input, Modal, Radio } from "antd";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { COURSE_OUTCOMES } from "@/lib/constants";

export type OutcomeTarget = {
  classId: number;
  enrollmentId: number;
  studentName: string;
  classCode: string;
  outcome: string | null;
  finalComment: string | null;
};

/** Kết quả cuối khóa + nhận xét tổng kết của giáo viên, in kèm lịch sử học tập gửi phụ huynh. */
export function OutcomeModal({ target, onClose, onSaved }: { target: OutcomeTarget | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) form.setFieldsValue({ outcome: target.outcome ?? undefined, finalComment: target.finalComment ?? "" });
  }, [target, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api(`/api/classes/${target!.classId}/enrollments/${target!.enrollmentId}/outcome`, {
        method: "PUT",
        body: { outcome: v.outcome ?? null, finalComment: v.finalComment ?? null },
      });
      message.success(`Đã lưu kết quả của ${target!.studentName}`);
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
      title={target ? `Kết quả cuối khóa · ${target.studentName} · ${target.classCode}` : ""}
      okText="Lưu"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="outcome" label="Kết quả">
          <Radio.Group>
            {COURSE_OUTCOMES.map((o) => (
              <Radio key={o.value} value={o.value} style={{ display: "block", marginBottom: 6 }}>
                {o.label}
              </Radio>
            ))}
          </Radio.Group>
        </Form.Item>
        <Form.Item name="finalComment" label="Nhận xét tổng kết gửi phụ huynh" extra="Điểm mạnh, điểm cần cố gắng, gợi ý khóa tiếp theo. In trong lịch sử học tập.">
          <Input.TextArea rows={5} maxLength={1000} showCount placeholder="VD: Con phát âm tốt, tự tin nói trước lớp. Cần luyện thêm viết câu. Nên học tiếp Kids 2." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
