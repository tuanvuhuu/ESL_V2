"use client";

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Select, Switch, Table, Tag } from "antd";
import { useState } from "react";
import { api, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import { CenterTag, Dash } from "@/components/ui";
import { USER_ROLES } from "@/lib/permissions";

type UserRow = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  centerId: number | null;
  teacherId: number | null;
  active: boolean;
  lastLoginAt: string | null;
  center: { id: number; name: string; color: string } | null;
  teacher: { id: number; displayName: string; code: string } | null;
};

type TeacherLite = { id: number; code: string; displayName: string; fullName: string; status: string };

const ROLE_HELP: Record<string, string> = {
  MANAGER: "Toàn quyền, cả 4 trung tâm.",
  OFFICE: "Thêm, sửa học sinh, lớp, lịch của trung tâm mình; xem được trung tâm khác.",
  TEACHER: "Chỉ xem lịch, lớp và học sinh lớp mình. Không thấy SĐT phụ huynh.",
  ASSISTANT: "Như giáo viên: chỉ xem lịch, lớp và học sinh lớp mình.",
};

/** Tài khoản đăng nhập: chỉ quản lý thấy tab này. */
export function UsersTab() {
  const { message } = App.useApp();
  const viewer = useViewer();
  const { centers } = useCenters();
  const { data, reload } = useApi<UserRow[]>("/api/users");
  const { data: teachers } = useApi<TeacherLite[]>("/api/teachers");
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const role = Form.useWatch("role", form) as string | undefined;

  const open = (u: UserRow | null) => {
    form.resetFields();
    form.setFieldsValue(u ? { ...u, password: "" } : { role: "OFFICE", active: true });
    setEditing(u);
  };

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) await api(`/api/users/${editing.id}`, { method: "PUT", body: v });
      else await api("/api/users", { body: v });
      message.success("Đã lưu");
      setEditing(undefined);
      void reload();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const taken = new Set((data ?? []).filter((u) => u.teacherId && u.id !== editing?.id).map((u) => u.teacherId));
  const isSelf = editing?.id === viewer.id;

  return (
    <>
      <div className="filter-bar">
        <span className="sub">Mỗi giáo vụ một tài khoản theo trung tâm. Giáo viên, trợ giảng dùng tài khoản gắn với hồ sơ của mình.</span>
        <div className="spacer" />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>
          Thêm tài khoản
        </Button>
      </div>
      <Table<UserRow>
        rowKey="id"
        pagination={false}
        dataSource={data}
        scroll={{ x: 760 }}
        columns={[
          { title: "Họ tên", dataIndex: "fullName" },
          { title: "Tên đăng nhập", dataIndex: "username" },
          {
            title: "Vai trò",
            render: (_, u) => {
              const r = USER_ROLES.find((x) => x.value === u.role);
              return <Tag style={{ color: r?.color, borderColor: r?.color, background: `${r?.color}12` }}>{r?.label ?? u.role}</Tag>;
            },
          },
          {
            title: "Phạm vi",
            render: (_, u) =>
              u.center ? (
                <CenterTag center={u.center} />
              ) : u.teacher ? (
                `${u.teacher.displayName} · ${u.teacher.code}`
              ) : u.role === "MANAGER" ? (
                "Cả 4 trung tâm"
              ) : (
                <Dash />
              ),
          },
          { title: "Trạng thái", render: (_, u) => (u.active ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã khóa</Tag>) },
          {
            title: "Đăng nhập gần nhất",
            render: (_, u) =>
              u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : <Dash />,
          },
          {
            title: "",
            render: (_, u) => (
              <Button size="small" onClick={() => open(u)}>
                Sửa
              </Button>
            ),
          },
        ]}
      />
      <Modal
        open={editing !== undefined}
        title={editing ? `Sửa tài khoản ${editing.username}` : "Thêm tài khoản"}
        onCancel={() => setEditing(undefined)}
        onOk={submit}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: "Nhập họ tên" }]}>
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="username"
              label="Tên đăng nhập"
              extra="Chữ không dấu, số, dấu chấm. Ví dụ: giaovu.a, lan.nguyen"
              rules={[{ required: true, pattern: /^[a-zA-Z0-9._-]{3,32}$/, message: "3–32 ký tự: chữ không dấu, số, dấu chấm, gạch" }]}
            >
              <Input autoCapitalize="none" />
            </Form.Item>
          )}
          <Form.Item name="role" label="Vai trò" extra={role ? ROLE_HELP[role] : undefined} rules={[{ required: true }]}>
            <Select options={USER_ROLES.map((r) => ({ value: r.value, label: r.label }))} disabled={isSelf} />
          </Form.Item>
          {role === "OFFICE" && (
            <Form.Item name="centerId" label="Trung tâm" rules={[{ required: true, message: "Chọn trung tâm" }]}>
              <Select options={centers.map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          )}
          {(role === "TEACHER" || role === "ASSISTANT") && (
            <Form.Item name="teacherId" label="Hồ sơ giáo viên / trợ giảng" rules={[{ required: true, message: "Chọn hồ sơ" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={(teachers ?? [])
                  .filter((t) => t.status !== "LEFT" || t.id === editing?.teacherId)
                  .map((t) => ({ value: t.id, label: `${t.displayName} · ${t.fullName} · ${t.code}`, disabled: taken.has(t.id) }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="password"
            label={editing ? "Đặt lại mật khẩu" : "Mật khẩu"}
            extra={
              editing
                ? "Để trống nếu không đổi. Đặt lại sẽ đăng xuất người này khỏi mọi thiết bị."
                : "Tối thiểu 8 ký tự. Người dùng tự đổi sau khi đăng nhập."
            }
            rules={[{ required: !editing, message: "Nhập mật khẩu" }, { min: 8, message: "Tối thiểu 8 ký tự" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="active" label="Cho phép đăng nhập" valuePropName="checked">
            <Switch disabled={isSelf} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
