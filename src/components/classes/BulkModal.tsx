"use client";

import { Alert, App, DatePicker, Form, Input, Modal, Select } from "@/client/primer-compat";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import type { Teacher } from "@/client/types";
import { formatDateVN } from "@/lib/dates";

export type BulkTarget = {
  action: "teacher" | "shift";
  classId: number;
  classCode: string;
  centerId: number;
  teacherId: number;
  assistantIds: number[];
  /** Ngày các buổi chưa hủy, chưa điểm danh từ hôm nay trở đi (gợi ý ngày bắt đầu). */
  upcoming: string[];
};

/** Thao tác hàng loạt ở hồ sơ lớp (M14): đổi giáo viên chính từ ngày X, dời các buổi từ ngày X sang ngày Y. */
export function BulkModal({ target, teachers, onClose, onSaved }: { target: BulkTarget | null; teachers: Teacher[]; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    form.resetFields();
    setError(null);
    form.setFieldsValue({ fromDate: target.upcoming[0] });
  }, [target, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    setError(null);
    try {
      const body =
        target!.action === "teacher"
          ? { action: "teacher", fromDate: v.fromDate, teacherId: v.teacherId }
          : { action: "shift", fromDate: v.fromDate, newDate: (v.newDate as Dayjs).format("YYYY-MM-DD"), reason: v.reason };
      const res = await api<{ changed: number; from?: string; to?: string }>(`/api/classes/${target!.classId}/bulk`, { body });
      message.success(
        target!.action === "teacher"
          ? `Đã đổi người dạy ${res.changed} buổi`
          : `Đã dời ${res.changed} buổi, học lại từ ${formatDateVN(res.from!)} đến ${formatDateVN(res.to!)}`,
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isTeacher = target?.action === "teacher";
  return (
    <Modal
      open={!!target}
      title={target ? `${isTeacher ? "Đổi giáo viên chính" : "Dời lịch học"} · ${target.classCode}` : ""}
      okText={isTeacher ? "Đổi giáo viên" : "Dời lịch"}
      cancelText="Hủy"
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      destroyOnHidden
    >
      {target && (
        <Form form={form} layout="vertical">
          <Form.Item name="fromDate" label={isTeacher ? "Áp dụng từ buổi" : "Dời từ buổi"} rules={[{ required: true, message: "Chọn buổi" }]}>
            <Select
              options={target.upcoming.map((d, i) => ({ value: d, label: `${formatDateVN(d, true)}${i === 0 ? " (buổi kế tiếp)" : ""}` }))}
              notFoundContent="Lớp không còn buổi nào sắp tới"
            />
          </Form.Item>
          {isTeacher ? (
            <Form.Item
              name="teacherId"
              label="Giáo viên mới"
              rules={[{ required: true, message: "Chọn giáo viên" }]}
              extra="Các buổi từ ngày đã chọn do giáo viên chính cũ dạy chuyển sang người mới. Buổi đang có người dạy thay giữ nguyên."
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={teachers
                  .filter(
                    (t) =>
                      t.status === "ACTIVE" &&
                      t.role !== "ASSISTANT" &&
                      t.id !== target.teacherId &&
                      !target.assistantIds.includes(t.id) &&
                      t.centers.some((c) => c.centerId === target.centerId),
                  )
                  .map((t) => ({ value: t.id, label: `${t.displayName} · ${t.fullName}` }))}
              />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                name="newDate"
                label="Học lại từ ngày"
                rules={[{ required: true, message: "Chọn ngày học lại" }]}
                extra="Các buổi từ buổi đã chọn được xếp lại theo lịch lặp của lớp, bắt đầu từ ngày này, bỏ ngày lễ. Giờ học và phòng giữ nguyên."
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: 180 }} disabledDate={(d) => d.isBefore(dayjs(), "day")} />
              </Form.Item>
              <Form.Item name="reason" label="Lý do" rules={[{ required: true, message: "Nhập lý do dời lịch" }]}>
                <Input maxLength={200} placeholder="VD: Trung tâm sửa phòng, nghỉ 1 tuần" />
              </Form.Item>
            </>
          )}
          {error && <Alert type="error" showIcon message={error} />}
        </Form>
      )}
    </Modal>
  );
}
