"use client";

import { Alert, App, Col, DatePicker, Form, InputNumber, Modal, Radio, Row, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { api, useApi } from "@/client/api";
import { useViewer } from "@/client/session";
import type { Course } from "@/client/types";
import { CLASS_STATUSES, optionOf, weekdayText } from "@/lib/constants";
import { formatDateVN } from "@/lib/dates";
import { DISCOUNT_TYPES, formatCurrency } from "@/lib/finance";
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
 * Ghi danh (Quy trình 4.1):
 * Chọn khóa học -> Chọn lớp -> Thỏa thuận học phí & chính sách giảm giá (nếu có) -> Xác lập hạn nợ -> Lưu ghi danh.
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
  const baseTuition = Form.useWatch("baseTuition", form) as number | undefined;
  const discountType = Form.useWatch("discountType", form) as string | undefined;
  const discountMode = Form.useWatch("discountMode", form) as "PERCENT" | "AMOUNT" | undefined;
  const discountValue = Form.useWatch("discountValue", form) as number | undefined;

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        mode: "class",
        courseId: student.waitingCourseId ?? undefined,
        discountMode: "PERCENT",
      });
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
    // Số buổi và học phí mặc định theo lớp (hoặc khóa) vừa chọn.
    const n = chosen?.totalSessions ?? course?.totalSessions;
    if (n) form.setFieldValue("purchasedSessions", n);
    if (course?.tuition !== undefined) {
      form.setFieldValue("baseTuition", course.tuition);
    }
  }, [chosen, course, form]);

  // Tính toán học phí thực đóng
  const feeCalc = useMemo(() => {
    const original = baseTuition ?? 0;
    if (!discountType || !discountValue || discountValue <= 0) {
      return { original, discount: 0, final: original };
    }
    const discount =
      discountMode === "AMOUNT"
        ? Math.min(original, discountValue)
        : Math.round(original * (Math.min(100, discountValue) / 100));
    return {
      original,
      discount,
      final: Math.max(0, original - discount),
    };
  }, [baseTuition, discountType, discountMode, discountValue]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (v.mode === "wait") {
        await api(`/api/students/${student.id}/waiting`, { method: "PUT", body: { courseId: v.courseId } });
        message.success(`${student.fullName} chờ xếp lớp khóa ${course?.name ?? ""}`);
      } else {
        const dueDate = v.dueDate ? (typeof v.dueDate === "string" ? v.dueDate : v.dueDate.format("YYYY-MM-DD")) : null;
        await api(`/api/classes/${v.classId}/enrollments`, {
          body: {
            studentId: student.id,
            purchasedSessions: v.purchasedSessions,
            tuitionFee: feeCalc.final,
            discountType: v.discountType || null,
            discountMode: v.discountType ? (v.discountMode || "PERCENT") : null,
            discountValue: v.discountType ? (v.discountValue || 0) : null,
            dueDate,
          },
        });
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
    <Modal
      open={open}
      title={`Ghi danh · ${student.fullName}`}
      okText="Lưu ghi danh"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      destroyOnHidden
      width="min(880px, calc(100vw - 48px))"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="courseId" label="Khóa học" rules={[{ required: mode === "wait", message: "Chọn khóa học sinh chờ" }]}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chọn khóa"
            options={(courses ?? []).map((c) => ({
              value: c.id,
              label: `${c.name}${c.level ? ` · ${c.level}` : ""} · ${c.totalSessions} buổi${c.tuition ? ` · ${formatCurrency(c.tuition)}` : ""}`,
            }))}
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
            <Form.Item
              name="classId"
              label="Lớp học"
              rules={[{ required: true, message: "Chọn lớp" }]}
              extra="Lớp trung tâm chính của học sinh hiện trước. Lớp đã đủ chỗ không chọn được; trùng giờ với lớp khác của học sinh sẽ báo khi lưu."
            >
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

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="purchasedSessions" label="Số buổi mua" rules={[{ required: true, message: "Nhập số buổi" }]}>
                  <InputNumber min={0} max={500} style={{ width: "100%" }} addonAfter="buổi" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="baseTuition" label="Học phí gốc">
                  <InputNumber
                    min={0}
                    step={100000}
                    style={{ width: "100%" }}
                    formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    addonAfter="₫"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={10}>
                <Form.Item name="discountType" label="Chính sách giảm giá">
                  <Select
                    allowClear
                    placeholder="Không giảm giá"
                    options={DISCOUNT_TYPES.map((d) => ({ value: d.value, label: d.label }))}
                    onChange={(val) => {
                      if (!val) {
                        form.setFieldValue("discountValue", undefined);
                      } else if (!form.getFieldValue("discountValue")) {
                        form.setFieldValue("discountValue", 10);
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              {discountType && (
                <>
                  <Col xs={12} md={7}>
                    <Form.Item name="discountMode" label="Kiểu giảm">
                      <Radio.Group
                        options={[
                          { value: "PERCENT", label: "%" },
                          { value: "AMOUNT", label: "Tiền mặt" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={7}>
                    <Form.Item name="discountValue" label="Mức giảm">
                      <InputNumber
                        min={0}
                        max={discountMode === "PERCENT" ? 100 : undefined}
                        style={{ width: "100%" }}
                        addonAfter={discountMode === "PERCENT" ? "%" : "₫"}
                      />
                    </Form.Item>
                  </Col>
                </>
              )}
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="dueDate" label="Hạn đóng học phí (nếu còn nợ)">
                  <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Chọn ngày hết hạn" />
                </Form.Item>
              </Col>
            </Row>

            <Alert
              type="info"
              style={{ marginTop: 8 }}
              message={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    Học phí gốc: <strong>{formatCurrency(feeCalc.original)}</strong>
                    {feeCalc.discount > 0 && (
                      <span style={{ color: "#cf222e", marginLeft: 8 }}>
                        (Giảm: -{formatCurrency(feeCalc.discount)})
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 16 }}>
                    Phải đóng: <strong style={{ color: "#1a7f37" }}>{formatCurrency(feeCalc.final)}</strong>
                  </span>
                </div>
              }
            />
          </>
        )}
      </Form>
    </Modal>
  );
}
