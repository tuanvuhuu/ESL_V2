"use client";

import { DownloadOutlined } from "@/client/primer-icons";
import { Button, Card, Col, Empty, Row, Skeleton, Table } from "@/client/primer-compat";
import Link from "next/link";
import { qs, useApi } from "@/client/api";
import { downloadCsv } from "@/client/csv";
import { CenterTag } from "@/components/ui";
import { DAY_PARTS, type DayPartKey } from "@/lib/reports";

type Center = { name: string; color: string };
type ClassRow = { id: number; code: string; name: string; center: Center; room: string; teacher: string; enrolled: number; capacity: number; free: number; fillRate: number };
type RoomRow = { id: number; name: string; center: Center; capacity: number; sessions: number; openDays: number; hours: number; rate: number; parts: Record<DayPartKey, number> };
type Data = {
  month: string;
  summary: { classes: number; enrolled: number; capacity: number; fillRate: number | null; roomRate: number | null };
  classes: ClassRow[];
  rooms: RoomRow[];
};

/** Thanh phần trăm nhỏ: dưới 50% vàng (còn trống nhiều), từ 90% xanh đậm. */
function Bar({ value }: { value: number }) {
  const color = value >= 90 ? "#1A7F37" : value >= 50 ? "#2DA44E" : "#D29922";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 110 }}>
      <span style={{ flex: 1, height: 6, borderRadius: 3, background: "#EFF2F5", overflow: "hidden" }}>
        <span style={{ display: "block", width: `${value}%`, height: "100%", background: color }} />
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums", width: 36, textAlign: "right" }}>{value}%</span>
    </span>
  );
}

/** Báo cáo sử dụng phòng và lớp (mục 3.8): tỷ lệ lấp đầy lớp, tỷ lệ dùng phòng theo khung giờ trong tháng. */
export function UtilizationReport({ centerId, month }: { centerId?: number | null; month: string }) {
  const { data, loading } = useApi<Data>(`/api/reports/utilization${qs({ centerId: centerId || undefined, month })}`);
  if (loading && !data) return <Skeleton active />;
  if (!data) return <Empty />;

  const exportCsv = () => {
    downloadCsv(
      `Bao_cao_lop_${data.month}.csv`,
      ["Lớp", "Tên", "Trung tâm", "Phòng", "Giáo viên", "Sĩ số", "Tối đa", "Còn trống", "Lấp đầy (%)"],
      data.classes.map((c) => [c.code, c.name, c.center.name, c.room, c.teacher, c.enrolled, c.capacity, c.free, c.fillRate]),
    );
    downloadCsv(
      `Bao_cao_phong_${data.month}.csv`,
      ["Phòng", "Trung tâm", "Sức chứa", "Số buổi", "Số giờ", ...DAY_PARTS.map((p) => `${p.label} (%)`), "Cả ngày (%)"],
      data.rooms.map((r) => [r.name, r.center.name, r.capacity, r.sessions, r.hours, ...DAY_PARTS.map((p) => r.parts[p.key]), r.rate]),
    );
  };

  const s = data.summary;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button icon={<DownloadOutlined />} onClick={exportCsv}>
          Xuất Excel (CSV)
        </Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div className="sub">Lớp đang mở</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{s.classes}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div className="sub">Sĩ số / chỗ</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {s.enrolled} / {s.capacity}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div className="sub">Tỷ lệ lấp đầy lớp</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#2DA44E" }}>{s.fillRate == null ? "—" : `${s.fillRate}%`}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div className="sub">Dùng phòng trung bình (8h–21h)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1F6FEB" }}>{s.roomRate == null ? "—" : `${s.roomRate}%`}</div>
          </Card>
        </Col>
      </Row>
      <Card size="small" title="Tỷ lệ lấp đầy lớp (lớp còn nhiều chỗ ở trên)" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={data.classes}
          locale={{ emptyText: "Không có lớp đang mở." }}
          columns={[
            { title: "Lớp", render: (_: unknown, c: ClassRow) => <Link href={`/classes/${c.id}`}>{c.code}</Link> },
            { title: "Tên", dataIndex: "name" },
            { title: "Trung tâm", render: (_: unknown, c: ClassRow) => <CenterTag center={c.center} /> },
            { title: "Phòng", dataIndex: "room" },
            { title: "Giáo viên", dataIndex: "teacher" },
            { title: "Sĩ số", align: "right" as const, render: (_: unknown, c: ClassRow) => `${c.enrolled}/${c.capacity}` },
            { title: "Còn trống", dataIndex: "free", align: "right" as const },
            { title: "Lấp đầy", render: (_: unknown, c: ClassRow) => <Bar value={c.fillRate} /> },
          ]}
        />
      </Card>
      <Card size="small" title="Sử dụng phòng theo khung giờ trong tháng" style={{ borderRadius: 8 }}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={data.rooms}
          locale={{ emptyText: "Không có phòng." }}
          columns={[
            { title: "Phòng", dataIndex: "name" },
            { title: "Trung tâm", render: (_: unknown, r: RoomRow) => <CenterTag center={r.center} /> },
            { title: "Số buổi", dataIndex: "sessions", align: "right" as const },
            { title: "Số giờ", dataIndex: "hours", align: "right" as const },
            ...DAY_PARTS.map((p) => ({ title: `${p.label} ${p.from}–${p.to}`, render: (_: unknown, r: RoomRow) => <Bar value={r.parts[p.key]} /> })),
            { title: "Cả ngày", render: (_: unknown, r: RoomRow) => <Bar value={r.rate} /> },
          ]}
        />
      </Card>
    </div>
  );
}
