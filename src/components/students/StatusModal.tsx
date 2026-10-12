"use client";

import { App, DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
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

const iso = (d?: Dayjs | null) => (d ? d.format("YYYY-MM-DD") : null);

/** Đổi trạng thái (DESIGN 5A.6). Bảo lưu: ngày bắt đầu + ngày dự kiến quay lại; học lại sau bảo lưu: ngày học lại. */
export function StatusModal({ open, student, initialStatus, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const status = Form.useWatch("status", form);
  const reserving = status === "RESERVED" && student?.status !== "RESERVED";
  const returning = student?.status === "RESERVED" && !!status && status !== "RESERVED";

  useEffect(() => {
    if (open && student) {
      form.setFieldsValue({
        status: initialStatus ?? student.status,
        reason: undefined,
        note: undefined,
        startDate: dayjs(),
        expectedReturn: undefined,
        returnDate: dayjs(),
      });
    }
  }, [open, student, initialStatus, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api(`/api/students/${student!.id}/status`, {
        body: {
          status: v.status,
          reason: v.reason,
          note: v.note,
          ...(reserving ? { startDate: iso(v.startDate), expectedReturn: iso(v.expectedReturn) } : {}),
          ...(returning ? { returnDate: iso(v.returnDate) } : {}),
        },
      });
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
        {reserving && (
          <>
            <div style={{ display: "flex", gap: 12 }}>
              <Form.Item name="startDate" label="Bảo lưu từ ngày" rules={[{ required: true, message: "Chọn ngày bắt đầu" }]} style={{ flex: 1 }}>
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name="expectedReturn"
                label="Dự kiến quay lại"
                dependencies={["startDate"]}
                style={{ flex: 1 }}
                rules={[
                  { required: true, message: "Chọn ngày quay lại" },
                  ({ getFieldValue }) => ({
                    validator: (_, d?: Dayjs) =>
                      !d || !getFieldValue("startDate") || d.isAfter(getFieldValue("startDate"), "day")
                        ? Promise.resolve()
                        : Promise.reject(new Error("Phải sau ngày bắt đầu")),
                  }),
                ]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </div>
            <Form.Item name="reason" label="Lý do bảo lưu">
              <Input placeholder="Ôn thi, đi du lịch, ốm…" />
            </Form.Item>
            <div className="sub" style={{ marginBottom: 12 }}>
              Trong thời gian bảo lưu, học sinh không có trong danh sách điểm danh; số buổi còn lại được giữ nguyên. Vẫn giữ chỗ trong lớp.
            </div>
          </>
        )}
        {returning && (
          <Form.Item name="returnDate" label="Học lại từ ngày" rules={[{ required: true, message: "Chọn ngày học lại" }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
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
