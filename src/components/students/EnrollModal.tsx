"use client";

import { Alert, App, Form, InputNumber, Modal, Radio, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { api, useApi } from "@/client/api";
import { useViewer } from "@/client/session";
import type { Course } from "@/client/types";
import { CLASS_STATUSES, optionOf, weekdayText } from "@/lib/constants";
import { formatDateVN } from "@/lib/dates";
import { canEditCenter } from "@/lib/permissions";

type ClassOption = {
  id: number;
  code: string;
  name: string;
  status: string;
  courseId: number | null;
  centerId: number;
  weekdays: string;
  startTime: string;
  endTime: string;
  startDate: string;
  totalSessions: number;
  maxStudents: number;
  center: { name: string };
  room: { name: string; capacity: number };
  teacher: { displayName: string };
  _count: { enrollments: number };
};

export type EnrollStudent = { id: number; fullName: string; centerId: number; waitingCourseId: number | null };

/**
 * Ghi danh (M5): chọn khóa, rồi xếp vào một lớp còn chỗ của khóa đó (lớp trung tâm chính hiện trước),
 * hoặc để "Chờ xếp lớp" theo khóa khi chưa có lớp phù hợp.
 */
export function EnrollModal({ student, open, onClose, onSaved }: { student: EnrollStudent; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const viewer = useViewer();
  const { data: courses } = useApi<Course[]>(open ? "/api/courses" : null);
  const { data: classes } = useApi<ClassOption[]>(open ? "/api/classes" : null);
  const courseId = Form.useWatch("courseId", form) as number | undefined;
  const mode = Form.useWatch("mode", form) as "class" | "wait" | undefined;
  const classId = Form.useWatch("classId", form) as number | undefined;

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ mode: "class", courseId: student.waitingCourseId ?? undefined });
    }
  }, [open, form, student.waitingCourseId]);

  const options = useMemo(
    () =>
      (classes ?? [])
        // Chỉ lớp mình được xếp (giáo vụ: trung tâm mình).
        .filter((c) => (c.status === "PLANNED" || c.status === "ACTIVE") && (!courseId || c.courseId === courseId) && canEditCenter(viewer, c.centerId))
        .sort((a, b) => Number(b.centerId === student.centerId) - Number(a.centerId === student.centerId) || a.startDate.localeCompare(b.startDate)),
    [classes, courseId, student.centerId, viewer],
  );
  const chosen = options.find((c) => c.id === classId);
  const course = courses?.find((c) => c.id === courseId);

  useEffect(() => {
    // Số buổi mặc định theo lớp (hoặc khóa) vừa chọn.
    const n = chosen?.totalSessions ?? course?.totalSessions;
    if (n) form.setFieldValue("purchasedSessions", n);
  }, [chosen, course, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (v.mode === "wait") {
        await api(`/api/students/${student.id}/waiting`, { method: "PUT", body: { courseId: v.courseId } });
        message.success(`${student.fullName} chờ xếp lớp khóa ${course?.name ?? ""}`);
      } else {
        await api(`/api/classes/${v.classId}/enrollments`, { body: { studentId: student.id, purchasedSessions: v.purchasedSessions } });
        message.success(`Đã xếp ${student.fullName} vào lớp ${chosen?.code ?? ""}`);
      }
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={`Ghi danh · ${student.fullName}`} okText="Lưu" cancelText="Hủy" onCancel={onClose} onOk={submit} confirmLoading={saving} destroyOnHidden width={620}>
      <Form form={form} layout="vertical">
        <Form.Item name="courseId" label="Khóa học" rules={[{ required: mode === "wait", message: "Chọn khóa học sinh chờ" }]}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chọn khóa"
            options={(courses ?? []).map((c) => ({ value: c.id, label: `${c.name}${c.level ? ` · ${c.level}` : ""} · ${c.totalSessions} buổi` }))}
            onChange={() => form.setFieldValue("classId", undefined)}
          />
        </Form.Item>
        <Form.Item name="mode">
          <Radio.Group
            optionType="button"
            options={[
              { value: "class", label: "Xếp vào lớp" },
              { value: "wait", label: "Chờ xếp lớp" },
            ]}
          />
        </Form.Item>
        {mode === "wait" ? (
          <Alert
            type="info"
            showIcon
            message="Học sinh chuyển sang Chờ xếp lớp theo khóa đã chọn. Khi xếp học sinh vào lớp của khóa này, hệ thống gợi ý em ở đầu danh sách."
          />
        ) : (
          <>
            <Form.Item name="classId" label="Lớp" rules={[{ required: true, message: "Chọn lớp" }]} extra="Lớp trung tâm chính của học sinh hiện trước. Lớp đã đủ chỗ không chọn được; trùng giờ với lớp khác của học sinh sẽ báo khi lưu.">
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={options.length ? "Chọn lớp" : "Không có lớp đang mở của khóa này"}
                notFoundContent="Không có lớp đang mở. Chọn Chờ xếp lớp."
                options={options.map((c) => {
                  const limit = Math.min(c.maxStudents, c.room.capacity);
                  const full = c._count.enrollments >= limit;
                  return {
                    value: c.id,
                    disabled: full,
                    label: `${c.code} · ${c.name} · ${c.center.name} · ${weekdayText(c.weekdays)} ${c.startTime}–${c.endTime} · ${c.teacher.displayName} · ${c._count.enrollments}/${limit}${full ? " (đủ chỗ)" : ""} · ${optionOf(CLASS_STATUSES, c.status)?.label} từ ${formatDateVN(c.startDate)}`,
                  };
                })}
              />
            </Form.Item>
            <Form.Item name="purchasedSessions" label="Số buổi mua" rules={[{ required: true, message: "Nhập số buổi" }]}>
              <InputNumber min={0} max={500} style={{ width: 160 }} addonAfter="buổi" />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
