"use client";

import { Empty, Skeleton, Timeline } from "antd";
import dayjs from "dayjs";
import { qs, useApi } from "@/client/api";
import type { AuditRow } from "@/client/types";

const ACTIONS: Record<string, string> = {
  create: "Tạo mới",
  update: "Cập nhật",
  status: "Đổi trạng thái",
  enroll: "Xếp vào lớp",
  leave: "Rời lớp",
  cancel: "Hủy buổi",
  restore: "Khôi phục buổi",
  "session-cancel": "Hủy buổi",
  "session-change": "Đổi buổi học",
  "guardian-add": "Thêm phụ huynh",
  "guardian-remove": "Gỡ phụ huynh",
};

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "∅" : Array.isArray(v) ? v.join(", ") : String(v));

export function AuditTimeline({ entity, id }: { entity: string; id: number }) {
  const { data, loading } = useApi<AuditRow[]>(`/api/audit${qs({ entity, id })}`);
  if (loading && !data) return <Skeleton active />;
  if (!data?.length) return <Empty description="Chưa có thay đổi nào." />;
  return (
    <Timeline
      items={data.map((r) => ({
        children: (
          <div>
            <div>
              <b>{ACTIONS[r.action] ?? r.action}</b> <span className="sub">· {dayjs(r.createdAt).format("DD/MM/YYYY HH:mm")} · {r.actor}</span>
            </div>
            {Object.entries(r.changes).map(([k, [a, b]]) => (
              <div key={k} className="sub">
                {k}: {show(a)} → {show(b)}
              </div>
            ))}
          </div>
        ),
      }))}
    />
  );
}
