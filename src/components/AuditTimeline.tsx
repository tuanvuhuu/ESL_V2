"use client";

import { Empty, Skeleton, Timeline } from "@/client/primer-compat";
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
  attendance: "Điểm danh",
  "attendance-update": "Sửa điểm danh",
  sessions: "Sửa số buổi",
  "makeup-add": "Xếp học bù",
  "makeup-remove": "Bỏ lịch học bù",
  transfer: "Chuyển lớp",
  reserve: "Bảo lưu",
  "reserve-end": "Học lại sau bảo lưu",
  availability: "Sửa lịch rảnh",
  "leave-add": "Đăng ký nghỉ",
  "leave-remove": "Hủy đăng ký nghỉ",
  outcome: "Kết quả cuối khóa",
  waiting: "Ghi danh chờ xếp lớp",
  contact: "Ghi liên lạc",
  bulk: "Thao tác hàng loạt",
};

/** Tên trường hiển thị trong lịch sử. */
const FIELDS: Record<string, string> = {
  class: "Lớp",
  purchasedSessions: "Số buổi đã mua",
  adjustment: "Điều chỉnh",
  adjustmentNote: "Lý do điều chỉnh",
  lessonContent: "Nội dung đã dạy",
  session: "Buổi",
  carriedSessions: "Số buổi chuyển theo",
  transferTo: "Chuyển sang lớp",
  transferFrom: "Chuyển từ lớp",
  date: "Ngày",
  centerId: "Trung tâm (mã)",
  status: "Trạng thái",
  reason: "Lý do",
  note: "Ghi chú",
  student: "Học sinh",
  startDate: "Bắt đầu",
  expectedReturn: "Dự kiến quay lại",
  returnedAt: "Học lại từ",
  slots: "Khung rảnh",
  leave: "Nghỉ",
  outcome: "Kết quả",
  finalComment: "Nhận xét cuối khóa",
  waitingCourse: "Khóa chờ xếp lớp",
  channel: "Cách liên lạc",
  followUpDate: "Hẹn gọi lại",
  teacher: "Giáo viên chính",
  fromDate: "Từ ngày",
  sessions: "Số buổi",
  shift: "Dời lịch",
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
                {FIELDS[k] ?? k}: {show(a)} → {show(b)}
              </div>
            ))}
          </div>
        ),
      }))}
    />
  );
}
