"use client";

import { App, Col, DatePicker, Form, Input, Modal, Row, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { useCenters } from "@/client/centers";
import type { Teacher } from "@/client/types";
import { EMPLOYMENTS, TEACHER_ORIGINS, TEACHER_ROLES, TEACHER_STATUSES } from "@/lib/constants";
import { isValidPhone } from "@/lib/text";

const opts = (o: readonly { value: string; label: string }[]) => o.map((x) => ({ value: x.value, label: x.label }));

export function TeacherFormModal({
  open,
  teacher,
  onClose,
  onSaved,
}: {
  open: boolean;
  teacher?: Teacher | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const { centers, centerId } = useCenters();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (teacher) {
      form.setFieldsValue({
        ...teacher,
        startDate: teacher.startDate ? dayjs(teacher.startDate) : undefined,
        certExpiry: teacher.certExpiry ? dayjs(teacher.certExpiry) : undefined,
        centerIds: teacher.centers.map((c) => c.centerId),
      });
    } else {
      form.setFieldsValue({
        role: "TEACHER",
        origin: "VN",
        employment: "PART_TIME",
        status: "ACTIVE",
        centerIds: centerId ? [centerId] : [],
      });
    }
  }, [open, teacher, form, centerId]);

  const submit = async () => {
    const v = await form.validateFields();
    const day = (d: unknown) => (d ? (d as Dayjs).format("YYYY-MM-DD") : null);
    const payload = { ...v, startDate: day(v.startDate), certExpiry: day(v.certExpiry) };
    setSaving(true);
    try {
      const saved = teacher
        ? await api<Teacher>(`/api/teachers/${teacher.id}`, { method: "PUT", body: payload })
        : await api<Teacher>("/api/teachers", { body: payload });
      message.success(teacher ? `Đã cập nhật ${saved.displayName}` : `Đã thêm ${saved.displayName}`);
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
      width="min(880px, calc(100vw - 48px))"
      style={{ top: 60 }}
      title={teacher ? `Sửa giáo viên · ${teacher.code}` : "Thêm giáo viên / trợ giảng"}
      onCancel={onClose}
      onOk={submit}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, whitespace: true, message: "Nhập họ và tên" }]}>
              <Input autoFocus />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="displayName" label="Tên hiển thị" extra="Ví dụ: Ms Lan, Mr John" rules={[{ required: true, whitespace: true, message: "Nhập tên hiển thị" }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
              <Select options={opts(TEACHER_ROLES)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
              <Select options={opts(TEACHER_STATUSES)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="origin" label="Quốc tịch" rules={[{ required: true }]}>
              <Select options={opts(TEACHER_ORIGINS)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="employment" label="Hình thức" rules={[{ required: true }]}>
              <Select options={opts(EMPLOYMENTS)} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="centerIds" label="Trung tâm dạy được" rules={[{ required: true, message: "Chọn ít nhất một trung tâm" }]}>
              <Select mode="multiple" options={centers.map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="phone"
              label="SĐT"
              rules={[{ validator: (_, v) => (!v || isValidPhone(v) ? Promise.resolve() : Promise.reject(new Error("SĐT gồm 10 số, bắt đầu bằng 0"))) }]}
            >
              <Input inputMode="tel" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="email" label="Email">
              <Input type="email" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="startDate" label="Ngày bắt đầu">
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="qualifications" label="Bằng cấp, chứng chỉ">
              <Input placeholder="IELTS 8.0, TESOL…" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="certExpiry" label="Chứng chỉ hết hạn ngày" extra="Hệ thống cảnh báo trước 60 ngày.">
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
