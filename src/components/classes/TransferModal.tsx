"use client";

import { Alert, App, Checkbox, DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { api, useApi } from "@/client/api";
import { useViewer } from "@/client/session";
import { weekdayText } from "@/lib/constants";
import { canEditCenter } from "@/lib/permissions";

export type TransferSource = {
  enrollmentId: number;
  classId: number;
  classCode: string;
  courseId: number | null;
  studentName: string;
  studentCenterId: number;
  remaining: number | null;
};

type ClassItem = {
  id: number;
  code: string;
  name: string;
  status: string;
  courseId: number | null;
  centerId: number;
  maxStudents: number;
  weekdays: string;
  startTime: string;
  endTime: string;
  center: { id: number; name: string; color: string };
  room: { name: string; capacity: number };
  course: { name: string } | null;
  teacher: { displayName: string };
  _count: { enrollments: number };
};

/** Chuyển lớp / chuyển trung tâm: số buổi còn lại đi theo học sinh sang lớp mới. */
export function TransferModal({ source, onClose, onSaved }: { source: TransferSource | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const viewer = useViewer();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { data: classes } = useApi<ClassItem[]>(source ? "/api/classes" : null);
  const toClassId = Form.useWatch("toClassId", form);

  useEffect(() => {
    if (source) form.setFieldsValue({ toClassId: undefined, date: dayjs(), note: undefined, moveCenter: true });
  }, [source, form]);

  const options = useMemo(() => {
    if (!source) return [];
    return (classes ?? [])
      .filter((c) => c.id !== source.classId && (c.status === "PLANNED" || c.status === "ACTIVE") && canEditCenter(viewer, c.centerId))
      .sort((a, b) => Number(b.courseId === source.courseId) - Number(a.courseId === source.courseId) || a.code.localeCompare(b.code));
  }, [classes, source, viewer]);

  if (!source) return null;
  const target = options.find((c) => c.id === toClassId);
  const limit = target ? Math.min(target.maxStudents, target.room.capacity) : 0;

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const r = await api<{ carried: number }>(`/api/classes/${source.classId}/enrollments/${source.enrollmentId}/transfer`, {
        body: { toClassId: v.toClassId, date: (v.date as Dayjs).format("YYYY-MM-DD"), note: v.note, moveCenter: !!v.moveCenter },
      });
      message.success(`Đã chuyển ${source.studentName} sang ${target?.code ?? "lớp mới"} kèm ${r.carried} buổi`);
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      width={560}
      title={`Chuyển lớp · ${source.studentName}`}
      onCancel={onClose}
      onOk={submit}
      okText="Chuyển lớp"
      cancelText="Hủy"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="toClassId" label={`Từ lớp ${source.classCode} sang lớp`} rules={[{ required: true, message: "Chọn lớp mới" }]}>
          <Select
            showSearch
            optionFilterProp="search"
            placeholder="Lớp cùng khóa hiện trước"
            options={options.map((c) => {
              const full = c._count.enrollments >= Math.min(c.maxStudents, c.room.capacity);
              return {
                value: c.id,
                search: `${c.code} ${c.name} ${c.teacher.displayName} ${c.center.name}`,
                disabled: full,
                label: (
                  <span>
                    <b>{c.code}</b> · {c.center.name} · {weekdayText(c.weekdays)} {c.startTime}–{c.endTime} · {c.teacher.displayName}
                    <span className="sub">
                      {" "}
                      · {c._count.enrollments}/{Math.min(c.maxStudents, c.room.capacity)}
                      {full ? " (đủ chỗ)" : ""}
                      {c.courseId === source.courseId ? " · cùng khóa" : c.course ? ` · ${c.course.name}` : ""}
                    </span>
                  </span>
                ),
              };
            })}
          />
        </Form.Item>
        <Form.Item name="date" label="Học lớp mới từ ngày" rules={[{ required: true, message: "Chọn ngày chuyển" }]} extra="Rời lớp cũ từ ngày này.">
          <DatePicker format="DD/MM/YYYY" />
        </Form.Item>
        {target && target.centerId !== source.studentCenterId && (
          <Form.Item name="moveCenter" valuePropName="checked">
            <Checkbox>Đổi trung tâm chính của học sinh sang {target.center.name}</Checkbox>
          </Form.Item>
        )}
        <Form.Item name="note" label="Ghi chú">
          <Input placeholder="Lý do chuyển lớp" />
        </Form.Item>
        <Alert
          type="info"
          showIcon
          message={
            source.remaining != null
              ? `Số buổi còn lại ${Math.max(0, source.remaining)} sẽ chuyển sang lớp mới.${target ? ` Lớp ${target.code} đang có ${target._count.enrollments}/${limit} học sinh.` : ""}`
              : "Số buổi còn lại sẽ chuyển sang lớp mới."
          }
        />
      </Form>
    </Modal>
  );
}
