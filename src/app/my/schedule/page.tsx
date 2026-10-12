"use client";

import { Empty, Segmented, Skeleton } from "@/client/primer-compat";
import { useState } from "react";
import { qs, useApi } from "@/client/api";
import { useViewer } from "@/client/session";
import type { ScheduleSession } from "@/client/types";
import { MySessionCard } from "@/components/my/SessionCard";
import { PageHeader } from "@/components/ui";
import { addDays, formatDateVN, startOfWeek, todayISO } from "@/lib/dates";

/** Lịch của tôi (G3): tuần này / tuần sau, gộp cả 4 trung tâm. */
export default function MySchedulePage() {
  const viewer = useViewer();
  const today = todayISO();
  const [offset, setOffset] = useState(0);
  const from = addDays(startOfWeek(today), offset * 7);
  const to = addDays(from, 6);
  const { data, loading } = useApi<ScheduleSession[]>(`/api/schedule${qs({ from, to })}`);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const sessions = data ?? [];
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        title="Lịch của tôi"
        description={`${formatDateVN(from)} – ${formatDateVN(to)} · ${sessions.filter((s) => s.status !== "CANCELLED").length} buổi`}
      />
      <Segmented
        block
        size="large"
        value={offset}
        onChange={(v) => setOffset(Number(v))}
        options={[
          { value: -1, label: "Tuần trước" },
          { value: 0, label: "Tuần này" },
          { value: 1, label: "Tuần sau" },
        ]}
        style={{ marginBottom: 8 }}
      />
      {loading && !data ? (
        <Skeleton active />
      ) : sessions.length === 0 ? (
        <Empty description="Không có buổi dạy nào trong tuần." style={{ marginTop: 24 }} />
      ) : (
        days.map((d) => {
          const items = sessions.filter((s) => s.date === d);
          if (items.length === 0) return null;
          return (
            <div key={d}>
              <div className={`day-label${d === today ? " today" : ""}`}>
                {formatDateVN(d, true)}
                {d === today ? " · Hôm nay" : ""}
              </div>
              {items.map((s) => (
                <MySessionCard key={s.id} s={s} teacherId={viewer.teacherId!} />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
