"use client";

import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, DatePicker, Empty, Segmented, Select, Space, Tag } from "antd";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { qs, useApi } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useViewer } from "@/client/session";
import type { ScheduleSession, Teacher } from "@/client/types";
import { SessionModal } from "@/components/classes/SessionModal";
import { RoomDayGrid } from "@/components/schedule/RoomDayGrid";
import { PageHeader } from "@/components/ui";
import { addDays, formatDateVN, startOfWeek, todayISO } from "@/lib/dates";
import { canEditCenter, canSeeTeachers, isStaff } from "@/lib/permissions";

function SchedulePageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const teacherId = Number(sp.get("teacherId")) || undefined;
  const classId = Number(sp.get("classId")) || undefined;
  const { centers, centerId } = useCenters();
  const viewer = useViewer();
  // Giáo viên, trợ giảng: mặc định xem tuần, chỉ lịch của mình (server đã lọc).
  const [view, setView] = useState<"day" | "week">(teacherId || classId || isStaff(viewer) ? "week" : "day");
  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState<ScheduleSession | null>(null);
  const { data: teachers } = useApi<Teacher[]>(canSeeTeachers(viewer) ? "/api/teachers" : null);
  // Buổi của trung tâm mình thì mở hộp sửa; không thì mở trang lớp để xem.
  const openSession = (s: ScheduleSession) => (canEditCenter(viewer, s.class.center.id) ? setOpen(s) : router.push(`/classes/${s.class.id}`));

  const from = view === "day" ? date : startOfWeek(date);
  const to = view === "day" ? date : addDays(from, 6);
  const { data, loading, reload } = useApi<ScheduleSession[]>(`/api/schedule${qs({ from, to, centerId, teacherId, classId })}`);
  const shownCenters = useMemo(() => (centerId ? centers.filter((c) => c.id === centerId) : centers), [centers, centerId]);

  const step = view === "day" ? 1 : 7;
  const setFilter = (key: string, value?: number) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, String(value));
    else next.delete(key);
    const s = next.toString();
    router.replace(`/schedule${s ? `?${s}` : ""}`);
  };

  return (
    <>
      <PageHeader title="Lịch học" description={view === "day" ? formatDateVN(date, true) : `Tuần ${formatDateVN(from)} – ${formatDateVN(to)}`} />
      <div className="panel">
        <div className="filter-bar">
          <Segmented
            value={view}
            onChange={(v) => setView(v as "day" | "week")}
            options={[
              { value: "day", label: "Ngày theo phòng" },
              { value: "week", label: "Tuần" },
            ]}
          />
          <Space.Compact>
            <Button icon={<LeftOutlined />} onClick={() => setDate(addDays(date, -step))} aria-label="Trước" />
            <DatePicker
              allowClear={false}
              format="DD/MM/YYYY"
              value={dayjs(date)}
              onChange={(d) => d && setDate(d.format("YYYY-MM-DD"))}
            />
            <Button icon={<RightOutlined />} onClick={() => setDate(addDays(date, step))} aria-label="Sau" />
          </Space.Compact>
          <Button onClick={() => setDate(todayISO())}>Hôm nay</Button>
          {canSeeTeachers(viewer) && (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Lọc giáo viên"
              style={{ width: 200 }}
              value={teacherId}
              onChange={(v) => setFilter("teacherId", v)}
              options={(teachers ?? []).map((t) => ({ value: t.id, label: t.displayName }))}
            />
          )}
          {classId && (
            <Tag closable onClose={() => setFilter("classId")}>
              Chỉ một lớp
            </Tag>
          )}
        </div>
        {view === "day" ? (
          shownCenters.length === 0 ? (
            <Empty />
          ) : (
            <RoomDayGrid centers={shownCenters} sessions={data ?? []} onOpen={openSession} />
          )
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, opacity: loading ? 0.6 : 1 }}>
            {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
              const items = (data ?? []).filter((s) => s.date === d);
              return (
                <div key={d}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: d === todayISO() ? "#1F6FEB" : undefined }}>{formatDateVN(d, true)}</div>
                  {items.length === 0 && <div className="muted">—</div>}
                  {items.map((s) => (
                    <div
                      key={s.id}
                      className="session-item"
                      style={{ borderLeftColor: s.class.center.color, cursor: "pointer", textDecoration: s.status === "CANCELLED" ? "line-through" : undefined }}
                      onClick={() => openSession(s)}
                    >
                      <b className="num">
                        {s.startTime}–{s.endTime}
                      </b>{" "}
                      {s.class.code}
                      <div className="sub">
                        {s.room.name} · {s.teacher.displayName}
                        {s.teacherId !== s.class.teacherId ? " · dạy thay" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <SessionModal
        open={!!open}
        session={open ? { ...open, classCode: open.class.code, centerId: open.class.center.id, studentCount: open.class._count.enrollments } : null}
        onClose={() => setOpen(null)}
        onSaved={() => {
          setOpen(null);
          void reload();
        }}
      />
    </>
  );
}

export default function SchedulePage() {
  return (
    <Suspense>
      <SchedulePageInner />
    </Suspense>
  );
}
