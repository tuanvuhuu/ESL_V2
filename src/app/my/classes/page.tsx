"use client";

import { Collapse, Empty, List, Skeleton, Space, Tag } from "@/client/primer-compat";
import Link from "next/link";
import { useApi } from "@/client/api";
import type { Balance } from "@/client/types";
import { BalanceCell } from "@/components/attendance/parts";
import { CenterTag, PageHeader, PersonAvatar, StatusTag } from "@/components/ui";
import { CLASS_STATUSES, weekdayText } from "@/lib/constants";

type MyClass = {
  id: number;
  code: string;
  name: string;
  status: string;
  weekdays: string;
  startTime: string;
  endTime: string;
  role: "teacher" | "assistant";
  center: { id: number; name: string; color: string };
  room: { name: string };
  teacher: { displayName: string };
  sessionsTotal: number;
  sessionsTaken: number;
  students: {
    id: number;
    code: string;
    fullName: string;
    englishName: string | null;
    balance: Balance | null;
    attendance: Record<string, number>;
  }[];
};

/** Lớp của tôi (G4): học sinh từng lớp, chuyên cần (số buổi có mặt / đã điểm danh). */
export default function MyClassesPage() {
  const { data, loading } = useApi<MyClass[]>("/api/me/classes");
  if (loading && !data) return <Skeleton active />;
  const classes = data ?? [];
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader title="Lớp của tôi" description={`${classes.length} lớp`} />
      {classes.length === 0 && <Empty description="Bạn chưa được xếp lớp nào." />}
      <Collapse
        defaultActiveKey={classes.length === 1 ? [classes[0].id] : []}
        items={classes.map((c) => ({
          key: c.id,
          label: (
            <div>
              <Space wrap size={[6, 2]}>
                <b>{c.code}</b>
                <span>{c.name}</span>
                <Tag color={c.role === "teacher" ? "blue" : "purple"}>{c.role === "teacher" ? "Dạy chính" : "Trợ giảng"}</Tag>
              </Space>
              <div className="sub">
                {weekdayText(c.weekdays)} · {c.startTime}–{c.endTime} · phòng {c.room.name} · {c.students.length} HS · đã điểm danh {c.sessionsTaken}/
                {c.sessionsTotal} buổi
              </div>
            </div>
          ),
          extra: <CenterTag center={c.center} />,
          children: (
            <>
              <Space style={{ marginBottom: 8 }} wrap>
                <StatusTag options={CLASS_STATUSES} value={c.status} />
                <span className="sub">Giáo viên chính: {c.teacher.displayName}</span>
                <Link href={`/classes/${c.id}`}>Mở hồ sơ lớp</Link>
              </Space>
              <List
                dataSource={c.students}
                locale={{ emptyText: "Lớp chưa có học sinh." }}
                renderItem={(s) => {
                  const present = (s.attendance.PRESENT ?? 0) + (s.attendance.LATE ?? 0);
                  const absent = (s.attendance.EXCUSED ?? 0) + (s.attendance.UNEXCUSED ?? 0);
                  const total = present + absent;
                  const rate = total ? Math.round((present / total) * 100) : null;
                  return (
                    <List.Item extra={<BalanceCell balance={s.balance} />}>
                      <List.Item.Meta
                        avatar={<PersonAvatar name={s.fullName} color={c.center.color} />}
                        title={
                          <Link href={`/students/${s.id}`}>
                            {s.fullName}
                            {s.englishName ? <span className="sub"> ({s.englishName})</span> : null}
                          </Link>
                        }
                        description={
                          total ? (
                            <span style={{ color: rate! < 80 ? "#CF222E" : undefined }}>
                              Chuyên cần {rate}% · có mặt {present}/{total}
                              {s.attendance.LATE ? ` · muộn ${s.attendance.LATE}` : ""}
                              {absent ? ` · vắng ${absent}` : ""}
                            </span>
                          ) : (
                            "Chưa có điểm danh"
                          )
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </>
          ),
        }))}
      />
    </div>
  );
}
