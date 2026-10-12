"use client";

import { Alert, App, Button, Checkbox, DatePicker, Form, Input, Modal, Select, Segmented, Space, TimePicker } from "@/client/primer-compat";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { ApiError, api, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import type { SessionRow, Teacher } from "@/client/types";
import { formatDateVN } from "@/lib/dates";
import { SubstituteModal } from "@/components/staffing/SubstituteModal";

type Props = {
  open: boolean;
  session: (SessionRow & { classCode: string; centerId: number; studentCount?: number }) | null;
  onClose: () => void;
  onSaved: () => void;
};

/** Hủy / dời / đổi phòng / dạy thay cho một buổi; báo rõ khi bị chặn trùng lịch. */
export function SessionModal({ open, session, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const { centers } = useCenters();
  const [mode, setMode] = useState<"change" | "cancel">("change");
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [finding, setFinding] = useState(false);
  const { data: teachers } = useApi<Teacher[]>(open ? "/api/teachers" : null);

  useEffect(() => {
    if (!open || !session) return;
    setMode("change");
    setBlocked(null);
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(session.date),
      time: [dayjs(session.startTime, "HH:mm"), dayjs(session.endTime, "HH:mm")],
      roomId: session.roomId,
      teacherId: session.teacherId,
      note: session.note,
      appendAtEnd: true,
    });
  }, [open, session, form]);

  if (!session) return null;
  const rooms = centers.find((c) => c.id === session.centerId)?.rooms ?? [];
  const cancelled = session.status === "CANCELLED";

  const run = async (body: unknown, ok: string) => {
    setSaving(true);
    setBlocked(null);
    try {
      await api(`/api/sessions/${session.id}`, { method: "PATCH", body });
      message.success(ok);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const d = e.details as { message: string }[] | undefined;
        setBlocked(d?.map((x) => x.message) ?? [e.message]);
      } else message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const v = await form.validateFields();
    if (mode === "cancel") {
      await run({ action: "cancel", reason: v.reason, appendAtEnd: !!v.appendAtEnd }, `Đã hủy buổi ${formatDateVN(session.date)}`);
    } else {
      await run(
        {
          action: "change",
          date: (v.date as Dayjs).format("YYYY-MM-DD"),
          startTime: (v.time[0] as Dayjs).format("HH:mm"),
          endTime: (v.time[1] as Dayjs).format("HH:mm"),
          roomId: v.roomId,
          teacherId: v.teacherId,
          note: v.note,
        },
        "Đã cập nhật buổi học",
      );
    }
  };

  return (
    <Modal
      open={open}
      width={560}
      title={`Buổi ${session.index} · ${session.classCode} · ${formatDateVN(session.date, true)}`}
      onCancel={onClose}
      destroyOnHidden
      footer={
        cancelled
          ? [
              <Button key="c" onClick={onClose}>
                Đóng
              </Button>,
              <Button key="r" type="primary" loading={saving} onClick={() => run({ action: "restore" }, "Đã khôi phục buổi học")}>
                Khôi phục buổi
              </Button>,
            ]
          : [
              <Button key="c" onClick={onClose}>
                Hủy bỏ
              </Button>,
              <Button key="s" type="primary" danger={mode === "cancel"} loading={saving} onClick={submit}>
                {mode === "cancel" ? "Hủy buổi học" : "Lưu thay đổi"}
              </Button>,
            ]
      }
    >
      {cancelled ? (
        <Alert type="error" showIcon message="Buổi này đã hủy" description={session.note ?? undefined} />
      ) : (
        <>
          <Segmented
            block
            style={{ marginBottom: 16 }}
            value={mode}
            onChange={(v) => setMode(v as "change" | "cancel")}
            options={[
              { value: "change", label: "Dời / đổi phòng / dạy thay" },
              { value: "cancel", label: "Hủy buổi" },
            ]}
          />
          {blocked && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="Không thể lưu"
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {blocked.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              }
            />
          )}
          <Form form={form} layout="vertical">
            {mode === "change" ? (
              <>
                <Space style={{ width: "100%" }} wrap>
                  <Form.Item name="date" label="Ngày" rules={[{ required: true }]}>
                    <DatePicker format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item name="time" label="Giờ" rules={[{ required: true }]}>
                    <TimePicker.RangePicker format="HH:mm" minuteStep={5} />
                  </Form.Item>
                </Space>
                <Form.Item name="roomId" label="Phòng" rules={[{ required: true }]}>
                  <Select options={rooms.map((r) => ({ value: r.id, label: `${r.name} (${r.capacity} chỗ)`, disabled: !r.active }))} />
                </Form.Item>
                <Form.Item
                  name="teacherId"
                  label={
                    <Space>
                      Người dạy
                      <Button size="small" type="link" style={{ padding: 0 }} onClick={() => setFinding(true)}>
                        Tìm người dạy thay
                      </Button>
                    </Space>
                  }
                  extra="Đổi người dạy = xếp dạy thay cho buổi này."
                  rules={[{ required: true }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={(teachers ?? [])
                      .filter((t) => t.status === "ACTIVE" && t.role !== "ASSISTANT")
                      .map((t) => ({ value: t.id, label: `${t.displayName} · ${t.fullName}` }))}
                  />
                </Form.Item>
                <Form.Item name="note" label="Ghi chú">
                  <Input />
                </Form.Item>
              </>
            ) : (
              <>
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={`Hủy buổi ${formatDateVN(session.date)}${session.studentCount ? ` – ${session.studentCount} học sinh sẽ không bị trừ buổi` : ""}.`}
                />
                <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: "Nhập lý do hủy" }]}>
                  <Input autoFocus />
                </Form.Item>
                <Form.Item name="appendAtEnd" valuePropName="checked">
                  <Checkbox>Nối một buổi vào cuối lịch</Checkbox>
                </Form.Item>
              </>
            )}
          </Form>
        </>
      )}
      <SubstituteModal
        session={finding ? { id: session.id, date: session.date, startTime: session.startTime, endTime: session.endTime, classCode: session.classCode } : null}
        onClose={() => setFinding(false)}
        onPick={(c) => {
          form.setFieldValue("teacherId", c.id);
          setFinding(false);
        }}
      />
    </Modal>
  );
}
