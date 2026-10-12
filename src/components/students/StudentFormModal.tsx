"use client";

import { Alert, App, Button, Col, DatePicker, Divider, Form, Input, Modal, Row, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { api, qs, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import type { Student } from "@/client/types";
import { AUDIENCES, GENDERS, QUIT_REASONS, RELATIONS, STUDENT_STATUSES } from "@/lib/constants";
import { formatDateVN } from "@/lib/dates";
import { formatPhone, isValidPhone, normalizePhone } from "@/lib/text";

type FoundParent = {
  id: number;
  fullName: string;
  phone: string;
  zalo: string | null;
  children: { student: { id: number; fullName: string; code: string } }[];
};

type Dup = { id: number; code: string; fullName: string; dob: string; center: { name: string } };

type Props = {
  open: boolean;
  student?: Student | null;
  onClose: () => void;
  onSaved: (s: Student) => void;
};

const phoneRule = {
  validator: (_: unknown, v?: string) =>
    !v || isValidPhone(v) ? Promise.resolve() : Promise.reject(new Error("SĐT gồm 10 số, bắt đầu bằng 0")),
};

export function StudentFormModal({ open, student, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const { centers, editableCenters, defaultEditableCenterId } = useCenters();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [found, setFound] = useState<FoundParent | null>(null);
  const [usedParentId, setUsedParentId] = useState<number | null>(null);
  const [dups, setDups] = useState<Dup[]>([]);
  const isEdit = !!student;

  const status = Form.useWatch("status", form);
  const phone = useDebounced(Form.useWatch("parentPhone", form) as string | undefined, 300);
  const fullName = useDebounced(Form.useWatch("fullName", form) as string | undefined, 400);
  const dob = Form.useWatch("dob", form) as Dayjs | undefined;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setFound(null);
    setUsedParentId(null);
    setDups([]);
    if (student) {
      form.setFieldsValue({ ...student, dob: dayjs(student.dob) });
    } else {
      form.setFieldsValue({ status: "WAITING", centerId: defaultEditableCenterId, relation: "Mẹ" });
    }
  }, [open, student, form, defaultEditableCenterId]);

  // SĐT phụ huynh đã có → gợi ý dùng thông tin này (DESIGN 5A.7).
  useEffect(() => {
    if (isEdit || !phone || !isValidPhone(phone)) {
      setFound(null);
      return;
    }
    let alive = true;
    api<FoundParent | null>(`/api/parents${qs({ phone: normalizePhone(phone) })}`)
      .then((p) => alive && setFound(p))
      .catch(() => alive && setFound(null));
    return () => {
      alive = false;
    };
  }, [phone, isEdit]);

  // Trùng tên + ngày sinh → cảnh báo vàng, vẫn cho lưu.
  useEffect(() => {
    if (!fullName || !dob) {
      setDups([]);
      return;
    }
    let alive = true;
    api<Dup[]>(`/api/students/duplicates${qs({ name: fullName, dob: dob.format("YYYY-MM-DD"), excludeId: student?.id })}`)
      .then((d) => alive && setDups(d))
      .catch(() => alive && setDups([]));
    return () => {
      alive = false;
    };
  }, [fullName, dob, student?.id]);

  const submit = async () => {
    const v = await form.validateFields();
    const studentBody = {
      fullName: v.fullName,
      englishName: v.englishName,
      dob: (v.dob as Dayjs).format("YYYY-MM-DD"),
      gender: v.gender,
      audience: v.audience,
      school: v.school,
      schoolGrade: v.schoolGrade,
      centerId: v.centerId,
      level: v.level,
      status: v.status,
      statusReason: v.status === "QUIT" ? v.statusReason : null,
      note: v.note,
    };
    setSaving(true);
    try {
      const saved = isEdit
        ? await api<Student>(`/api/students/${student!.id}`, { method: "PUT", body: studentBody })
        : await api<Student>("/api/students", {
            body: {
              student: studentBody,
              parent: {
                parentId: usedParentId ?? undefined,
                fullName: v.parentName,
                phone: v.parentPhone,
                relation: v.relation,
                zalo: v.parentZalo,
                note: v.parentNote,
              },
            },
          });
      message.success(isEdit ? `Đã cập nhật ${saved.fullName}` : `Đã thêm ${saved.fullName}`);
      onSaved(saved);
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
      title={isEdit ? `Sửa học sinh · ${student!.code}` : "Thêm học sinh"}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="c" onClick={onClose}>
          Hủy
        </Button>,
        <Button key="s" type="primary" loading={saving} onClick={submit}>
          Lưu
        </Button>,
      ]}
    >
      {dups.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Có thể trùng hồ sơ: ${dups.map((d) => `${d.fullName} (${d.code}, ${formatDateVN(d.dob)}, ${d.center.name})`).join("; ")}. Kiểm tra lại trước khi lưu.`}
        />
      )}
      <Form form={form} layout="vertical" requiredMark>
        <Divider orientation="left" plain style={{ marginTop: 0 }}>
          Thông tin học sinh
        </Divider>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, whitespace: true, message: "Nhập họ và tên" }]}>
              <Input autoFocus />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="englishName" label="Tên tiếng Anh">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="dob"
              label="Ngày sinh"
              rules={[
                { required: true, message: "Chọn ngày sinh" },
                {
                  validator: (_, v?: Dayjs) =>
                    !v || !v.isAfter(dayjs(), "day") ? Promise.resolve() : Promise.reject(new Error("Ngày sinh không được ở tương lai")),
                },
              ]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="gender" label="Giới tính" rules={[{ required: true, message: "Chọn giới tính" }]}>
              <Select options={GENDERS.map((g) => ({ value: g.value, label: g.label }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="audience" label="Nhóm đối tượng" rules={[{ required: true, message: "Chọn nhóm đối tượng" }]}>
              <Select options={AUDIENCES.map((g) => ({ value: g.value, label: g.label }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="school" label="Trường đang học">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>
          Trung tâm và trạng thái
        </Divider>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="centerId" label="Trung tâm chính" rules={[{ required: true, message: "Chọn trung tâm" }]}>
              {/* Thêm mới: chỉ trung tâm mình. Sửa: chọn được trung tâm khác để chuyển học sinh đi. */}
              <Select options={(student ? centers : editableCenters).map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="status"
              label="Trạng thái"
              rules={[{ required: true }]}
              extra={student ? "Đổi trạng thái, bảo lưu ở nút Đổi trạng thái." : undefined}
            >
              <Select
                disabled={!!student}
                options={STUDENT_STATUSES.filter((s) => student || s.value !== "RESERVED").map((s) => ({ value: s.value, label: s.label }))}
              />
            </Form.Item>
          </Col>
          {status === "QUIT" && !student && (
            <Col xs={24} md={12}>
              <Form.Item name="statusReason" label="Lý do nghỉ" rules={[{ required: true, message: "Chọn lý do nghỉ" }]}>
                <Select options={QUIT_REASONS.map((r) => ({ value: r, label: r }))} />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} md={12}>
            <Form.Item name="level" label="Trình độ đầu vào">
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>

        {!isEdit && (
          <>
            <Divider orientation="left" plain>
              Phụ huynh chính
            </Divider>
            {found && usedParentId !== found.id && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message={`SĐT này thuộc phụ huynh ${found.fullName}${found.children.length ? ` (con: ${found.children.map((c) => c.student.fullName).join(", ")})` : ""}`}
                action={
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      setUsedParentId(found.id);
                      form.setFieldsValue({ parentName: found.fullName, parentZalo: found.zalo });
                    }}
                  >
                    Dùng thông tin này
                  </Button>
                }
              />
            )}
            {found && usedParentId === found.id && (
              <Alert type="success" showIcon style={{ marginBottom: 12 }} message={`Sẽ liên kết với phụ huynh ${found.fullName} (${formatPhone(found.phone)}).`} />
            )}
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="parentPhone" label="SĐT" rules={[{ required: true, message: "Nhập SĐT phụ huynh" }, phoneRule]}>
                  <Input inputMode="tel" placeholder="0912 345 678" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="parentName" label="Họ tên phụ huynh" rules={[{ required: true, whitespace: true, message: "Nhập họ tên phụ huynh" }]}>
                  <Input disabled={!!found && usedParentId === found.id} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="relation" label="Quan hệ" rules={[{ required: true, message: "Chọn quan hệ" }]}>
                  <Select options={RELATIONS.map((r) => ({ value: r, label: r }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="parentZalo" label="Zalo">
                  <Input disabled={!!found && usedParentId === found.id} />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}
        <div className="sub">Thông tin chi tiết khác bổ sung sau trong hồ sơ.</div>
      </Form>
    </Modal>
  );
}
