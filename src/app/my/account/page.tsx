"use client";

import { KeyOutlined, LeftOutlined, LogoutOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Card, Col, Descriptions, List, Row, Skeleton, Space, Statistic, Tag } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { qs, useApi } from "@/client/api";
import { useSession, useViewer } from "@/client/session";
import type { Teacher } from "@/client/types";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { AvailabilityEditor } from "@/components/staffing/AvailabilityEditor";
import { LeavePanel } from "@/components/staffing/LeavePanel";
import { PageHeader } from "@/components/ui";
import { formatMinutes } from "@/lib/attendance";
import { formatDateVN, todayISO } from "@/lib/dates";
import { roleLabel } from "@/lib/permissions";

type Totals = { sessions: number; minutes: number };
type Hours = {
  month: string;
  sessions: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    role: "teacher" | "assistant";
    substitute: boolean;
    minutes: number;
    done: boolean;
    attendanceTakenAt: string | null;
    class: { id: number; code: string; center: { name: string; color: string } };
  }[];
  totals: { teacher: { done: Totals; upcoming: Totals }; assistant: { done: Totals; upcoming: Totals } };
};

/** Tài khoản (G5): thông tin, giờ dạy tháng này, đăng ký nghỉ, lịch rảnh, đổi mật khẩu. */
export default function MyAccountPage() {
  const viewer = useViewer();
  const { logout } = useSession();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [changing, setChanging] = useState(false);
  const { data, loading } = useApi<Hours>(`/api/me/hours${qs({ month })}`);
  const { data: me } = useApi<Teacher>(viewer.teacherId ? `/api/teachers/${viewer.teacherId}` : null);
  const shift = (n: number) => setMonth(dayjs(`${month}-01`).add(n, "month").format("YYYY-MM"));
  const t = data?.totals;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader title="Tài khoản" />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Họ tên">{viewer.fullName}</Descriptions.Item>
          <Descriptions.Item label="Vai trò">{roleLabel(viewer.role)}</Descriptions.Item>
          <Descriptions.Item label="Tên đăng nhập">{viewer.username}</Descriptions.Item>
        </Descriptions>
        <Space wrap style={{ marginTop: 8 }}>
          <Button icon={<KeyOutlined />} onClick={() => setChanging(true)}>
            Đổi mật khẩu
          </Button>
          {viewer.teacherId && <Link href={`/teachers/${viewer.teacherId}`}>Hồ sơ của tôi</Link>}
          <Button danger type="text" icon={<LogoutOutlined />} onClick={() => void logout()}>
            Đăng xuất
          </Button>
        </Space>
      </Card>

      {viewer.teacherId && (
        <>
          <Card size="small" title="Đăng ký nghỉ" style={{ marginBottom: 12 }}>
            <LeavePanel teacherId={viewer.teacherId} editable canArrange={() => false} />
          </Card>
          <Card size="small" title="Lịch rảnh trong tuần" style={{ marginBottom: 12 }}>
            <AvailabilityEditor teacherId={viewer.teacherId} centers={me?.centers.map((c) => c.center) ?? []} editable />
          </Card>
        </>
      )}
      <Card
        size="small"
        title={`Giờ dạy tháng ${month.slice(5)}/${month.slice(0, 4)}`}
        extra={
          <Space>
            <Button size="small" icon={<LeftOutlined />} onClick={() => shift(-1)} aria-label="Tháng trước" />
            <Button size="small" icon={<RightOutlined />} onClick={() => shift(1)} aria-label="Tháng sau" />
          </Space>
        }
      >
        {loading && !data ? (
          <Skeleton active />
        ) : (
          t && (
            <>
              <Row gutter={[12, 12]}>
                <Col xs={12}>
                  <Statistic title="Dạy chính (đã dạy)" value={formatMinutes(t.teacher.done.minutes)} valueStyle={{ fontSize: 20 }} />
                  <div className="sub">
                    {t.teacher.done.sessions} buổi · còn {t.teacher.upcoming.sessions} buổi sắp tới
                  </div>
                </Col>
                <Col xs={12}>
                  <Statistic title="Trợ giảng (đã dạy)" value={formatMinutes(t.assistant.done.minutes)} valueStyle={{ fontSize: 20 }} />
                  <div className="sub">
                    {t.assistant.done.sessions} buổi · còn {t.assistant.upcoming.sessions} buổi sắp tới
                  </div>
                </Col>
              </Row>
              <List
                size="small"
                style={{ marginTop: 12 }}
                dataSource={data.sessions}
                locale={{ emptyText: "Tháng này không có buổi dạy." }}
                renderItem={(s) => (
                  <List.Item extra={<span className="num">{formatMinutes(s.minutes)}</span>}>
                    <span style={{ opacity: s.done ? 1 : 0.6 }}>
                      {formatDateVN(s.date, true)} · {s.startTime} · <span style={{ color: s.class.center.color }}>{s.class.code}</span>{" "}
                      {s.role === "assistant" && <Tag color="purple">Trợ giảng</Tag>}
                      {s.substitute && <Tag color="magenta">Dạy thay</Tag>}
                      {!s.done && <Tag>Sắp tới</Tag>}
                    </span>
                  </List.Item>
                )}
              />
              <div className="sub" style={{ marginTop: 8 }}>
                Tính các buổi theo lịch (không tính buổi đã hủy).
              </div>
            </>
          )
        )}
      </Card>
      <ChangePasswordModal open={changing} onClose={() => setChanging(false)} />
    </div>
  );
}
