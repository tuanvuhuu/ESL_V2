"use client";

import { Alert, App, Button, Checkbox, Col, DatePicker, Form, Input, InputNumber, List, Row, Select, Steps, TimePicker } from "@/client/primer-compat";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { ApiError, api, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import { PrimerModal } from "@/components/PrimerModal";
import type { Course, Teacher } from "@/client/types";
import { WEEKDAYS } from "@/lib/constants";
import { formatDateVN } from "@/lib/dates";

type Preview = {
  dates: string[];
  skipped: { date: string; name?: string }[];
  endDate: string | null;
  conflicts: { kind: string; date: string; message: string; classId?: number }[];
  warnings: string[];
};

export function ClassFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: number) => void }) {
  const { message } = App.useApp();
  const { centers, editableCenters, defaultEditableCenterId } = useCenters();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: courses } = useApi<Course[]>(open ? "/api/courses" : null);
  const { data: teachers } = useApi<(Teacher & { activeClassCount: number })[]>(open ? "/api/teachers" : null);

  const formCenter = Form.useWatch("centerId", form) as number | undefined;
  const teacherId = Form.useWatch("teacherId", form) as number | undefined;
  const rooms = centers.find((c) => c.id === formCenter)?.rooms.filter((r) => r.active) ?? [];

  const staff = useMemo(
    () => (teachers ?? []).filter((t) => t.status === "ACTIVE" && (!formCenter || t.centers.some((c) => c.centerId === formCenter))),
    [teachers, formCenter],
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setStep(0);
    setPreview(null);
    form.setFieldsValue({
      centerId: defaultEditableCenterId,
      weekdays: [1, 3, 5],
      time: [dayjs("18:00", "HH:mm"), dayjs("19:30", "HH:mm")],
      startDate: dayjs(),
      totalSessions: 24,
      maxStudents: 12,
      assistantIds: [],
    });
  }, [open, form, defaultEditableCenterId]);

  const payload = () => {
    const v = form.getFieldsValue(true);
    return {
      name: v.name,
      courseId: v.courseId ?? null,
      centerId: v.centerId,
      roomId: v.roomId,
      teacherId: v.teacherId,
      assistantIds: v.assistantIds ?? [],
      weekdays: v.weekdays,
      startTime: (v.time?.[0] as Dayjs | undefined)?.format("HH:mm"),
      endTime: (v.time?.[1] as Dayjs | undefined)?.format("HH:mm"),
      startDate: (v.startDate as Dayjs | undefined)?.format("YYYY-MM-DD"),
      totalSessions: v.totalSessions,
      maxStudents: v.maxStudents,
      note: v.note,
    };
  };

  const STEP_FIELDS = [
    ["name", "centerId", "maxStudents", "totalSessions"],
    ["weekdays", "time", "startDate", "roomId"],
    ["teacherId", "assistantIds"],
  ];

  const next = async () => {
    await form.validateFields(STEP_FIELDS[step]);
    if (step === 2) {
      try {
        setPreview(await api<Preview>("/api/classes/preview", { body: payload() }));
      } catch (e) {
        message.error((e as Error).message);
        return;
      }
    }
    setStep(step + 1);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const cls = await api<{ id: number; code: string }>("/api/classes", { body: payload() });
      message.success(`Đã mở lớp ${cls.code}`);
      onSaved(cls.id);
    } catch (e) {
      message.error((e as Error).message);
      if (e instanceof ApiError && e.status === 409 && preview) {
        setPreview({ ...preview, conflicts: (e.details as Preview["conflicts"]) ?? preview.conflicts });
      }
    } finally {
      setSaving(false);
    }
  };

  const onCourse = (id?: number) => {
    const c = courses?.find((x) => x.id === id);
    if (c) {
      const start = (form.getFieldValue("time")?.[0] as Dayjs | undefined) ?? dayjs("18:00", "HH:mm");
      form.setFieldsValue({
        totalSessions: c.totalSessions,
        maxStudents: c.maxStudents,
        time: [start, start.add(c.sessionMinutes, "minute")],
        name: form.getFieldValue("name") || c.name,
      });
    }
  };

  return (
    <PrimerModal
      open={open}
      width="min(880px, calc(100vw - 48px))"
      title="Mở lớp mới"
      subtitle="Thiết lập khóa học, lịch phòng, giáo viên và kiểm tra trùng lịch"
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button onClick={onClose}>Hủy</Button>
          {step > 0 && (
            <Button onClick={() => setStep(step - 1)}>
              Quay lại
            </Button>
          )}
          {step < 3 ? (
            <Button type="primary" onClick={next}>
              {step === 2 ? "Xem trước lịch" : "Tiếp theo"}
            </Button>
          ) : (
            <Button type="primary" loading={saving} disabled={!preview || preview.conflicts.length > 0} onClick={submit}>
              Xác nhận mở lớp
            </Button>
          )}
        </div>
      }
    >
      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 16 }}
        items={[{ title: "Khóa & trung tâm" }, { title: "Lịch & phòng" }, { title: "Người dạy" }, { title: "Xem trước" }]}
      />
      <Form form={form} layout="vertical" preserve>
        <div style={{ display: step === 0 ? "block" : "none" }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="courseId" label="Khóa học">
                <Select allowClear placeholder="Chọn khóa" onChange={onCourse} options={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="centerId" label="Trung tâm" rules={[{ required: true, message: "Chọn trung tâm" }]}>
                <Select
                  options={editableCenters.map((c) => ({ value: c.id, label: c.name }))}
                  onChange={() => form.setFieldsValue({ roomId: undefined, teacherId: undefined, assistantIds: [] })}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Tên lớp" rules={[{ required: true, whitespace: true, message: "Nhập tên lớp" }]}>
                <Input placeholder="KID2-Lions" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="maxStudents" label="Sĩ số tối đa" rules={[{ required: true }]}>
                <InputNumber min={1} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="totalSessions" label="Số buổi" rules={[{ required: true }]}>
                <InputNumber min={1} max={300} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="Ghi chú">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </div>
        <div style={{ display: step === 1 ? "block" : "none" }}>
          <Form.Item name="weekdays" label="Học vào các thứ" rules={[{ required: true, message: "Chọn ít nhất một thứ trong tuần" }]}>
            <Checkbox.Group options={WEEKDAYS.map((w) => ({ value: w.value, label: w.label }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="time"
                label="Giờ học"
                rules={[
                  { required: true, message: "Chọn giờ học" },
                  {
                    validator: (_, v?: [Dayjs, Dayjs]) =>
                      !v || v[0].isBefore(v[1]) ? Promise.resolve() : Promise.reject(new Error("Giờ kết thúc phải sau giờ bắt đầu")),
                  },
                ]}
              >
                <TimePicker.RangePicker format="HH:mm" minuteStep={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="startDate" label="Ngày khai giảng" rules={[{ required: true, message: "Chọn ngày khai giảng" }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="roomId" label="Phòng" rules={[{ required: true, message: "Chọn phòng" }]}>
                <Select options={rooms.map((r) => ({ value: r.id, label: `${r.name} (${r.capacity} chỗ)` }))} placeholder={formCenter ? "Chọn phòng" : "Chọn trung tâm trước"} />
              </Form.Item>
            </Col>
          </Row>
        </div>
        <div style={{ display: step === 2 ? "block" : "none" }}>
          <Form.Item name="teacherId" label="Giáo viên chính" rules={[{ required: true, message: "Chọn giáo viên" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={staff.filter((t) => t.role !== "ASSISTANT").map((t) => ({ value: t.id, label: `${t.displayName} · ${t.fullName}` }))}
            />
          </Form.Item>
          <Form.Item
            name="assistantIds"
            label="Trợ giảng (0–2 người)"
            rules={[{ validator: (_, v?: number[]) => (!v || v.length <= 2 ? Promise.resolve() : Promise.reject(new Error("Mỗi lớp tối đa 2 trợ giảng"))) }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={staff
                .filter((t) => t.role !== "TEACHER" && t.id !== teacherId)
                .map((t) => ({ value: t.id, label: `${t.displayName} · ${t.fullName}` }))}
            />
          </Form.Item>
          <div className="sub">Hệ thống kiểm tra trùng phòng và trùng người dạy ở bước sau.</div>
        </div>
        {step === 3 && preview && (
          <div>
            {preview.conflicts.length > 0 && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                message={`Bị chặn: ${preview.conflicts.length} buổi trùng lịch`}
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {preview.conflicts.slice(0, 6).map((c, i) => (
                      <li key={i}>{c.message}</li>
                    ))}
                    {preview.conflicts.length > 6 && <li>… và {preview.conflicts.length - 6} buổi khác</li>}
                  </ul>
                }
              />
            )}
            {preview.warnings.map((w) => (
              <Alert key={w} type="warning" showIcon style={{ marginBottom: 12 }} message={w} />
            ))}
            {preview.conflicts.length === 0 && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 12 }}
                message={`${preview.dates.length} buổi, từ ${formatDateVN(preview.dates[0] ?? "", true)} đến ${formatDateVN(preview.endDate ?? "", true)}. Không trùng lịch.`}
              />
            )}
            {preview.skipped.length > 0 && (
              <div className="sub" style={{ marginBottom: 8 }}>
                Bỏ qua ngày lễ: {preview.skipped.map((s) => `${formatDateVN(s.date)}${s.name ? ` (${s.name})` : ""}`).join(", ")}
              </div>
            )}
            <List
              size="small"
              bordered
              style={{ maxHeight: 280, overflow: "auto" }}
              dataSource={preview.dates}
              renderItem={(d, i) => {
                const bad = preview.conflicts.some((c) => c.date === d);
                return (
                  <List.Item style={{ color: bad ? "var(--fgColor-danger)" : undefined }}>
                    Buổi {i + 1} · {formatDateVN(d, true)}
                    {bad ? " · bị trùng" : ""}
                  </List.Item>
                );
              }}
            />
          </div>
        )}
      </Form>
    </PrimerModal>
  );
}
