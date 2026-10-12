"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Empty, Select, Skeleton, Space, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { api, useApi } from "@/client/api";
import { WEEKDAYS } from "@/lib/constants";
import { toMinutes } from "@/lib/dates";

type Slot = { weekday: number; startTime: string; endTime: string; centerId: number | null };
type CenterLite = { id: number; name: string; color: string };

const DAY_START = 7 * 60;
const DAY_END = 22 * 60;
const pct = (t: string) => `${((Math.min(Math.max(toMinutes(t), DAY_START), DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
const HOURS = [8, 10, 12, 14, 16, 18, 20];

/** Lưới tuần: mỗi thứ một dải 07:00–22:00, tô các khung rảnh theo màu trung tâm (xám = mọi trung tâm). */
function WeekBars({ slots, centers }: { slots: Slot[]; centers: CenterLite[] }) {
  const color = (id: number | null) => centers.find((c) => c.id === id)?.color ?? "#2DA44E";
  return (
    <div className="avail-grid">
      <div className="avail-row avail-head">
        <span />
        <div className="avail-track">
          {HOURS.map((h) => (
            <span key={h} className="avail-hour" style={{ left: pct(`${String(h).padStart(2, "0")}:00`) }}>
              {h}h
            </span>
          ))}
        </div>
      </div>
      {WEEKDAYS.map((w) => (
        <div key={w.value} className="avail-row">
          <span className="sub">{w.short}</span>
          <div className="avail-track avail-bg">
            {slots
              .filter((s) => s.weekday === w.value)
              .map((s, i) => (
                <span
                  key={i}
                  className="avail-bar"
                  title={`${s.startTime}–${s.endTime}${s.centerId ? ` · ${centers.find((c) => c.id === s.centerId)?.name ?? ""}` : ""}`}
                  style={{ left: pct(s.startTime), width: `calc(${pct(s.endTime)} - ${pct(s.startTime)})`, background: color(s.centerId) }}
                >
                  {s.startTime}–{s.endTime}
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lịch rảnh hằng tuần (DESIGN 6.3): xem dạng lưới tuần, sửa dạng danh sách khung giờ. */
export function AvailabilityEditor({ teacherId, centers, editable }: { teacherId: number; centers: CenterLite[]; editable: boolean }) {
  const { message } = App.useApp();
  const { data, loading, reload } = useApi<Slot[]>(`/api/teachers/${teacherId}/availability`);
  const [draft, setDraft] = useState<Slot[] | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading && !data) return <Skeleton active />;
  const slots = data ?? [];

  const save = async () => {
    if (!draft) return;
    if (draft.some((s) => s.startTime >= s.endTime)) return void message.error("Giờ kết thúc phải sau giờ bắt đầu");
    setSaving(true);
    try {
      await api(`/api/teachers/${teacherId}/availability`, { method: "PUT", body: { slots: draft } });
      message.success("Đã lưu lịch rảnh");
      setDraft(null);
      void reload();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const set = (i: number, patch: Partial<Slot>) => setDraft((d) => d!.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const add = () => {
    const last = draft?.[draft.length - 1];
    setDraft((d) => [...(d ?? []), { weekday: last ? (last.weekday % 7) + 1 : 1, startTime: last?.startTime ?? "17:00", endTime: last?.endTime ?? "21:00", centerId: last?.centerId ?? null }]);
  };

  if (draft) {
    return (
      <div>
        <WeekBars slots={draft} centers={centers} />
        <div style={{ marginTop: 12 }}>
          {draft.map((s, i) => (
            <Space key={i} wrap style={{ marginBottom: 8 }}>
              <Select style={{ width: 110 }} value={s.weekday} onChange={(v) => set(i, { weekday: v })} options={WEEKDAYS.map((w) => ({ value: w.value, label: w.label }))} />
              <TimePicker.RangePicker
                format="HH:mm"
                minuteStep={15}
                allowClear={false}
                value={[dayjs(s.startTime, "HH:mm"), dayjs(s.endTime, "HH:mm")]}
                onChange={(v) => v?.[0] && v?.[1] && set(i, { startTime: (v[0] as Dayjs).format("HH:mm"), endTime: (v[1] as Dayjs).format("HH:mm") })}
              />
              {centers.length > 1 && (
                <Select
                  style={{ width: 170 }}
                  value={s.centerId ?? 0}
                  onChange={(v) => set(i, { centerId: v || null })}
                  options={[{ value: 0, label: "Mọi trung tâm" }, ...centers.map((c) => ({ value: c.id, label: c.name }))]}
                />
              )}
              <Button type="text" danger icon={<DeleteOutlined />} aria-label="Xóa khung" onClick={() => setDraft((d) => d!.filter((_, j) => j !== i))} />
            </Space>
          ))}
        </div>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={add}>
            Thêm khung
          </Button>
          <div style={{ flex: 1 }} />
          <Button onClick={() => setDraft(null)}>Hủy</Button>
          <Button type="primary" loading={saving} onClick={save}>
            Lưu lịch rảnh
          </Button>
        </Space>
      </div>
    );
  }

  return (
    <div>
      {slots.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa khai lịch rảnh. Khi tìm người dạy thay sẽ hiện nhãn “Chưa khai lịch rảnh”." />
      ) : (
        <WeekBars slots={slots} centers={centers} />
      )}
      {editable && (
        <Button style={{ marginTop: 12 }} onClick={() => setDraft(slots.map(({ weekday, startTime, endTime, centerId }) => ({ weekday, startTime, endTime, centerId })))}>
          Sửa lịch rảnh
        </Button>
      )}
    </div>
  );
}
