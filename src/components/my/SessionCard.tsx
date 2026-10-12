"use client";

import { CheckCircleFilled, EditOutlined } from "@/client/primer-icons";
import { Button, Tag } from "@/client/primer-compat";
import Link from "next/link";
import type { ScheduleSession } from "@/client/types";
import { todayISO } from "@/lib/dates";

/** Thẻ một buổi cho giáo viên, trợ giảng (G1, G3): giờ, lớp, phòng, trung tâm, vai trò, nút Điểm danh. */
export function MySessionCard({ s, teacherId }: { s: ScheduleSession; teacherId: number }) {
  const cancelled = s.status === "CANCELLED";
  const role = s.teacherId === teacherId ? (s.class.teacherId === teacherId ? "Dạy chính" : "Dạy thay") : "Trợ giảng";
  const taken = !!s.attendanceTakenAt;
  const canOpen = !cancelled && s.date <= todayISO();
  const students = s.class._count.enrollments + (s._count?.makeups ?? 0);
  return (
    <div className={`my-card${cancelled ? " cancelled" : ""}`} style={{ borderLeftColor: s.class.center.color }}>
      <div className="my-card-head">
        <span className="my-card-time">
          {s.startTime}–{s.endTime}
        </span>
        <Link href={`/classes/${s.class.id}`}>
          <b>{s.class.code}</b>
        </Link>
        <span className="sub">{s.class.name}</span>
      </div>
      <div className="sub" style={{ marginTop: 2 }}>
        Phòng {s.room.name} · <span style={{ color: s.class.center.color }}>{s.class.center.name}</span> · {students} HS
        {s._count?.makeups ? ` (${s._count.makeups} học bù)` : ""}
      </div>
      {s.lessonContent && <div className="sub">Đã dạy: {s.lessonContent}</div>}
      <div style={{ marginTop: 6 }}>
        <Tag color={role === "Trợ giảng" ? "purple" : role === "Dạy thay" ? "magenta" : "blue"}>{role}</Tag>
        {cancelled && <Tag color="red">Đã hủy{s.note ? `: ${s.note}` : ""}</Tag>}
        {!cancelled && taken && (
          <Tag color="green" icon={<CheckCircleFilled />}>
            Đã điểm danh
          </Tag>
        )}
        {!cancelled && !taken && s.date < todayISO() && <Tag color="orange">Chưa điểm danh</Tag>}
      </div>
      {canOpen && (
        <div className="my-card-actions">
          <Link href={`/sessions/${s.id}`} style={{ flex: 1, display: "flex" }}>
            <Button type={taken ? "default" : "primary"} icon={taken ? <EditOutlined /> : undefined} block>
              {taken ? "Xem / sửa điểm danh" : "Điểm danh"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
