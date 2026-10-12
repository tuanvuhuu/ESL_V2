"use client";

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, DatePicker, Empty, Form, Input, List, Modal, Popconfirm, Skeleton, Space, Tag } from "antd";
import type { Dayjs } from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { api, useApi } from "@/client/api";
import { formatDateVN, todayISO } from "@/lib/dates";
import { SubstituteModal, type SubstituteTarget } from "./SubstituteModal";

type Affected = {
  id: number;
  index: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  role: "teacher" | "substituted" | "assistant";
  teacher: { id: number; displayName: string };
  class: { id: number; code: string; name: string; centerId: number; center: { name: string; color: string } };
};
type Leave = { id: number; fromDate: string; toDate: string; reason: string; createdBy: string; affected: Affected[] };

function AffectedTag({ s }: { s: Affected }) {
  if (s.status === "CANCELLED") return <Tag color="red">Đã hủy</Tag>;
  if (s.role === "substituted") return <Tag color="purple">{s.teacher.displayName} dạy thay</Tag>;
  if (s.role === "assistant") return <Tag>Trợ giảng</Tag>;
  return <Tag color="orange">Cần người dạy thay</Tag>;
}

/**
 * Ngày nghỉ của một người (DESIGN 6.3): đăng ký khoảng ngày → hiện ngay các buổi bị ảnh hưởng,
 * mỗi buổi có nút "Tìm người dạy thay" (với người xếp được lịch của trung tâm đó).
 */
export function LeavePanel({
  teacherId,
  editable,
  canArrange,
}: {
  teacherId: number;
  editable: boolean;
  /** Có quyền xếp dạy thay cho buổi ở trung tâm này không. */
  canArrange: (centerId: number) => boolean;
}) {
  const { message } = App.useApp();
  const { data, loading, reload } = useApi<Leave[]>(`/api/teachers/${teacherId}/leaves`);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<SubstituteTarget | null>(null);
  const [form] = Form.useForm();
  const today = todayISO();

  const submit = async () => {
    const v = await form.validateFields();
    const [from, to] = v.range as [Dayjs, Dayjs];
    setSaving(true);
    try {
      const leave = await api<Leave>(`/api/teachers/${teacherId}/leaves`, {
        body: { fromDate: from.format("YYYY-MM-DD"), toDate: to.format("YYYY-MM-DD"), reason: v.reason },
      });
      const need = leave.affected.filter((s) => s.role === "teacher" && s.status !== "CANCELLED").length;
      message.success(need ? `Đã đăng ký nghỉ. ${need} buổi cần người dạy thay.` : "Đã đăng ký nghỉ");
      setAdding(false);
      form.resetFields();
      void reload();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api(`/api/leaves/${id}`, { method: "DELETE" });
      message.success("Đã hủy đăng ký nghỉ");
      void reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  if (loading && !data) return <Skeleton active />;
  const leaves = data ?? [];
  const upcoming = leaves.filter((l) => l.toDate >= today);
  const past = leaves.filter((l) => l.toDate < today);

  const leaveCard = (l: Leave) => (
    <Card
      key={l.id}
      size="small"
      style={{ marginBottom: 12, opacity: l.toDate < today ? 0.7 : 1 }}
      title={
        <span>
          Nghỉ {l.fromDate === l.toDate ? formatDateVN(l.fromDate, true) : `${formatDateVN(l.fromDate, true)} → ${formatDateVN(l.toDate, true)}`}
        </span>
      }
      extra={
        editable &&
        l.toDate >= today && (
          <Popconfirm title="Hủy đăng ký nghỉ này?" description="Người dạy thay đã xếp vẫn giữ nguyên." okText="Hủy đăng ký" cancelText="Không" onConfirm={() => remove(l.id)}>
            <Button size="small" type="text" danger>
              Hủy đăng ký
            </Button>
          </Popconfirm>
        )
      }
    >
      <div className="sub" style={{ marginBottom: 8 }}>
        {l.reason} · ghi bởi {l.createdBy}
      </div>
      <List
        size="small"
        dataSource={l.affected}
        locale={{ emptyText: "Không có buổi nào bị ảnh hưởng." }}
        renderItem={(s) => (
          <List.Item
            actions={
              s.status !== "CANCELLED" && s.role !== "assistant" && s.date >= today && canArrange(s.class.centerId)
                ? [
                    <Button
                      key="sub"
                      size="small"
                      type={s.role === "teacher" ? "primary" : "default"}
                      onClick={() => setSub({ id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, classCode: s.class.code })}
                    >
                      {s.role === "teacher" ? "Tìm người dạy thay" : "Đổi người dạy thay"}
                    </Button>,
                  ]
                : []
            }
          >
            <span>
              <b>{formatDateVN(s.date, true)}</b> {s.startTime}–{s.endTime} · <Link href={`/classes/${s.class.id}`}>{s.class.code}</Link>{" "}
              <span style={{ color: s.class.center.color }}>{s.class.center.name}</span> <AffectedTag s={s} />
            </span>
          </List.Item>
        )}
      />
    </Card>
  );

  return (
    <div>
      {editable && (
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>
          Đăng ký nghỉ
        </Button>
      )}
      {leaves.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có ngày nghỉ nào." />}
      {upcoming.map(leaveCard)}
      {past.length > 0 && (
        <>
          <div className="sub" style={{ margin: "8px 0" }}>
            Đã qua
          </div>
          {past.map(leaveCard)}
        </>
      )}
      <Modal open={adding} title="Đăng ký nghỉ" onCancel={() => setAdding(false)} onOk={submit} okText="Lưu" cancelText="Hủy" confirmLoading={saving} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="range" label="Nghỉ từ ngày → đến ngày" rules={[{ required: true, message: "Chọn ngày nghỉ" }]}>
            <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: "Nhập lý do nghỉ" }]}>
            <Input placeholder="Ốm, việc gia đình…" />
          </Form.Item>
          <Space className="sub">Lưu xong sẽ hiện các buổi bị ảnh hưởng để giáo vụ xếp người dạy thay.</Space>
        </Form>
      </Modal>
      <SubstituteModal
        session={sub}
        onClose={() => setSub(null)}
        onSaved={() => {
          setSub(null);
          void reload();
        }}
      />
    </div>
  );
}
