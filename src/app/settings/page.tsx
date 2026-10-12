"use client";

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, ColorPicker, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, Tabs, Tag } from "antd";
import { useState } from "react";
import { api, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import type { Center, Course, Room } from "@/client/types";
import { UsersTab } from "@/components/settings/UsersTab";
import { CenterTag, Dash, PageHeader } from "@/components/ui";
import { formatDateVN } from "@/lib/dates";
import { formatMoney } from "@/lib/text";

type Holiday = { id: number; date: string; name: string; centerId: number | null; center: { name: string } | null };

/** Modal biểu mẫu dùng chung cho các danh mục. */
function useFormModal<T>(save: (values: T, editing: unknown) => Promise<void>) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<unknown>(undefined);
  const [saving, setSaving] = useState(false);
  const open = (record: unknown, initial: Record<string, unknown>) => {
    form.resetFields();
    form.setFieldsValue(initial);
    setEditing(record ?? null);
  };
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await save(v as T, editing);
      message.success("Đã lưu");
      setEditing(undefined);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return { form, editing, open, close: () => setEditing(undefined), submit, saving, isOpen: editing !== undefined };
}

function CentersTab() {
  const { centers, reloadCenters } = useCenters();
  const centerModal = useFormModal<{ name: string; address?: string; openHours?: string; color: string | { toHexString(): string } }>(async (v, editing) => {
    const color = typeof v.color === "string" ? v.color : v.color.toHexString();
    await api(`/api/centers/${(editing as Center).id}`, { method: "PUT", body: { ...v, color: color.toUpperCase() } });
    await reloadCenters();
  });
  const roomModal = useFormModal<Omit<Room, "id">>(async (v, editing) => {
    const r = editing as Room | null;
    if (r?.id) await api(`/api/rooms/${r.id}`, { method: "PUT", body: v });
    else await api("/api/rooms", { body: v });
    await reloadCenters();
  });

  return (
    <>
      <Table<Center>
        rowKey="id"
        pagination={false}
        dataSource={centers}
        expandable={{
          defaultExpandAllRows: true,
          expandedRowRender: (c) => (
            <Table<Room>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={c.rooms}
              locale={{ emptyText: "Chưa có phòng." }}
              columns={[
                { title: "Phòng", dataIndex: "name" },
                { title: "Sức chứa", dataIndex: "capacity" },
                { title: "Thiết bị", render: (_, r) => r.equipment ?? <Dash /> },
                { title: "Trạng thái", render: (_, r) => (r.active ? <Tag color="green">Đang dùng</Tag> : <Tag>Tạm khóa</Tag>) },
                { title: "", render: (_, r) => <Button size="small" onClick={() => roomModal.open(r, { ...r })}>Sửa</Button> },
              ]}
              footer={() => (
                <Button size="small" icon={<PlusOutlined />} onClick={() => roomModal.open(null, { centerId: c.id, capacity: 12, active: true })}>
                  Thêm phòng
                </Button>
              )}
            />
          ),
        }}
        columns={[
          { title: "Mã", dataIndex: "code", width: 60 },
          { title: "Trung tâm", render: (_, c) => <CenterTag center={c} /> },
          { title: "Địa chỉ", render: (_, c) => c.address ?? <Dash /> },
          { title: "Giờ hoạt động", render: (_, c) => c.openHours ?? <Dash /> },
          { title: "Số phòng", render: (_, c) => c.rooms.length },
          { title: "", render: (_, c) => <Button size="small" onClick={() => centerModal.open(c, { ...c })}>Sửa</Button> },
        ]}
      />
      <Modal open={centerModal.isOpen} title="Sửa trung tâm" onCancel={centerModal.close} onOk={centerModal.submit} confirmLoading={centerModal.saving} okText="Lưu" cancelText="Hủy">
        <Form form={centerModal.form} layout="vertical">
          <Form.Item name="name" label="Tên" rules={[{ required: true, message: "Nhập tên trung tâm" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input />
          </Form.Item>
          <Form.Item name="openHours" label="Giờ hoạt động">
            <Input placeholder="08:00–21:00" />
          </Form.Item>
          <Form.Item name="color" label="Màu nhận diện" rules={[{ required: true }]}>
            <ColorPicker disabledAlpha format="hex" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal open={roomModal.isOpen} title="Phòng học" onCancel={roomModal.close} onOk={roomModal.submit} confirmLoading={roomModal.saving} okText="Lưu" cancelText="Hủy">
        <Form form={roomModal.form} layout="vertical">
          <Form.Item name="centerId" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="name" label="Tên phòng" rules={[{ required: true, message: "Nhập tên phòng" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="capacity" label="Sức chứa" rules={[{ required: true }]}>
            <InputNumber min={1} max={200} />
          </Form.Item>
          <Form.Item name="equipment" label="Thiết bị">
            <Input placeholder="Máy chiếu, loa…" />
          </Form.Item>
          <Form.Item name="active" label="Đang dùng" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function HolidaysTab() {
  const { message } = App.useApp();
  const { centers } = useCenters();
  const { data, reload } = useApi<Holiday[]>("/api/holidays");
  const modal = useFormModal<{ date: { format(f: string): string }; name: string; centerId?: number }>(async (v) => {
    await api("/api/holidays", { body: { ...v, date: v.date.format("YYYY-MM-DD"), centerId: v.centerId ?? null } });
    await reload();
  });
  return (
    <>
      <div className="filter-bar">
        <span className="sub">Lớp mở mới sẽ tự bỏ qua các ngày nghỉ này. Lớp đã mở không tự đổi lịch.</span>
        <div className="spacer" />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => modal.open(null, {})}>
          Thêm ngày nghỉ
        </Button>
      </div>
      <Table<Holiday>
        rowKey="id"
        pagination={false}
        dataSource={data}
        locale={{ emptyText: "Chưa có ngày nghỉ." }}
        columns={[
          { title: "Ngày", render: (_, h) => formatDateVN(h.date, true) },
          { title: "Tên", dataIndex: "name" },
          { title: "Áp dụng", render: (_, h) => h.center?.name ?? "Tất cả trung tâm" },
          {
            title: "",
            render: (_, h) => (
              <Popconfirm
                title="Xóa ngày nghỉ này?"
                okText="Xóa"
                cancelText="Hủy"
                onConfirm={async () => {
                  await api(`/api/holidays/${h.id}`, { method: "DELETE" });
                  message.success("Đã xóa");
                  void reload();
                }}
              >
                <Button size="small" danger type="text">
                  Xóa
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />
      <Modal open={modal.isOpen} title="Thêm ngày nghỉ" onCancel={modal.close} onOk={modal.submit} confirmLoading={modal.saving} okText="Lưu" cancelText="Hủy">
        <Form form={modal.form} layout="vertical">
          <Form.Item name="date" label="Ngày" rules={[{ required: true, message: "Chọn ngày" }]}>
            <DatePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="name" label="Tên" rules={[{ required: true, message: "Nhập tên ngày nghỉ" }]}>
            <Input placeholder="Quốc khánh" />
          </Form.Item>
          <Form.Item name="centerId" label="Áp dụng cho">
            <Select allowClear placeholder="Tất cả trung tâm" options={centers.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function CoursesTab() {
  const { data, reload } = useApi<Course[]>("/api/courses");
  const modal = useFormModal<Omit<Course, "id">>(async (v, editing) => {
    const c = editing as Course | null;
    if (c?.id) await api(`/api/courses/${c.id}`, { method: "PUT", body: v });
    else await api("/api/courses", { body: v });
    await reload();
  });
  return (
    <>
      <div className="filter-bar">
        <div className="spacer" />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => modal.open(null, { totalSessions: 24, sessionMinutes: 90, tuition: 0, maxStudents: 12 })}
        >
          Thêm khóa học
        </Button>
      </div>
      <Table<Course>
        rowKey="id"
        pagination={false}
        dataSource={data}
        columns={[
          { title: "Khóa", dataIndex: "name" },
          { title: "Chương trình", render: (_, c) => c.program ?? <Dash /> },
          { title: "Cấp độ", render: (_, c) => c.level ?? <Dash /> },
          { title: "Số buổi", dataIndex: "totalSessions" },
          { title: "Phút/buổi", dataIndex: "sessionMinutes" },
          { title: "Học phí chuẩn", render: (_, c) => <span className="num">{formatMoney(c.tuition)}</span> },
          { title: "Sĩ số tối đa", dataIndex: "maxStudents" },
          { title: "", render: (_, c) => <Button size="small" onClick={() => modal.open(c, { ...c })}>Sửa</Button> },
        ]}
      />
      <Modal open={modal.isOpen} title="Khóa học" onCancel={modal.close} onOk={modal.submit} confirmLoading={modal.saving} okText="Lưu" cancelText="Hủy">
        <Form form={modal.form} layout="vertical">
          <Form.Item name="name" label="Tên khóa" rules={[{ required: true, message: "Nhập tên khóa" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="program" label="Chương trình">
            <Input placeholder="Kids, Teens, IELTS…" />
          </Form.Item>
          <Form.Item name="level" label="Cấp độ">
            <Input />
          </Form.Item>
          <Form.Item name="totalSessions" label="Số buổi chuẩn" rules={[{ required: true }]}>
            <InputNumber min={1} max={300} />
          </Form.Item>
          <Form.Item name="sessionMinutes" label="Thời lượng buổi (phút)" rules={[{ required: true }]}>
            <InputNumber min={15} max={480} step={15} />
          </Form.Item>
          <Form.Item name="tuition" label="Học phí chuẩn (₫)" rules={[{ required: true }]}>
            <InputNumber min={0} step={100000} style={{ width: 200 }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} parser={(v) => Number((v ?? "").replace(/\./g, "")) as 0} />
          </Form.Item>
          <Form.Item name="maxStudents" label="Sĩ số tối đa" rules={[{ required: true }]}>
            <InputNumber min={1} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Cài đặt" description="Trung tâm, phòng học, ngày nghỉ lễ, khóa học và tài khoản" />
      <div className="panel">
        <Tabs
          items={[
            { key: "centers", label: "Trung tâm & phòng", children: <CentersTab /> },
            { key: "holidays", label: "Ngày nghỉ lễ", children: <HolidaysTab /> },
            { key: "courses", label: "Khóa học", children: <CoursesTab /> },
            { key: "users", label: "Tài khoản", children: <UsersTab /> },
          ]}
        />
      </div>
    </>
  );
}
