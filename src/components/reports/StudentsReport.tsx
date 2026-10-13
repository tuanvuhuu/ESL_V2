"use client";

import { DownloadOutlined } from "@/client/primer-icons";
import { Button, Card, Col, Empty, Row, Skeleton, Table } from "@/client/primer-compat";
import Link from "next/link";
import { qs, useApi } from "@/client/api";
import { downloadXlsx } from "@/client/xlsx";
import { STUDENT_STATUSES } from "@/lib/constants";
import { formatDateVN } from "@/lib/dates";

type Person = { id: number; code: string; fullName: string };
type Data = {
  month: string;
  byStatus: Record<string, number>;
  newEnrollments: { id: number; joinedAt: string; student: Person; classCode: string; courseName: string }[];
  reservations: { id: number; startDate: string; expectedReturn: string; reason: string | null; student: Person }[];
  quits: (Person & { statusReason: string | null })[];
  quitReasons: { reason: string; count: number }[];
  retention: { ended: number; continued: number; rate: number | null };
};

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "var(--fgColor-default)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </Card>
  );
}

const studentLink = (s: Person) => (
  <Link href={`/students/${s.id}`}>
    {s.fullName} <span className="sub">{s.code}</span>
  </Link>
);

/** Báo cáo học sinh theo tháng (mục 3.8): trạng thái, ghi danh mới, bảo lưu, nghỉ theo lý do, tỷ lệ học tiếp. */
export function StudentsReport({ centerId, month }: { centerId?: number | null; month: string }) {
  const { data, loading } = useApi<Data>(`/api/reports/students${qs({ centerId: centerId || undefined, month })}`);
  if (loading && !data) return <Skeleton active />;
  if (!data) return <Empty />;
  const r = data.retention;

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ...STUDENT_STATUSES.map((s) => ["Trạng thái hiện tại", s.label, data.byStatus[s.value] ?? 0]),
      ["Trong tháng", "Ghi danh mới", data.newEnrollments.length],
      ["Trong tháng", "Bảo lưu mới", data.reservations.length],
      ["Trong tháng", "Nghỉ học", data.quits.length],
      ...data.quitReasons.map((q) => ["Lý do nghỉ", q.reason, q.count]),
      ["Học tiếp", `${r.continued}/${r.ended} học sinh học hết khóa`, r.rate == null ? "" : `${r.rate}%`],
    ];
    downloadXlsx(`Bao_cao_hoc_sinh_${data.month}.xlsx`, ["Nhóm", "Chỉ số", "Giá trị"], rows);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button icon={<DownloadOutlined />} onClick={exportCsv}>
          Xuất Excel (.xlsx)
        </Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Stat label="Đang học (hiện tại)" value={data.byStatus.STUDYING ?? 0} color="var(--fgColor-success)" />
        </Col>
        <Col xs={12} sm={6}>
          <Stat label="Ghi danh mới trong tháng" value={data.newEnrollments.length} color="var(--fgColor-accent)" />
        </Col>
        <Col xs={12} sm={6}>
          <Stat label="Nghỉ học trong tháng" value={data.quits.length} color={data.quits.length ? "var(--fgColor-danger)" : undefined} />
        </Col>
        <Col xs={12} sm={6}>
          <Stat label={`Tỷ lệ học tiếp (${r.continued}/${r.ended})`} value={r.rate == null ? "—" : `${r.rate}%`} color="var(--fgColor-done)" />
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Học sinh theo trạng thái (hiện tại)" style={{ borderRadius: 8 }}>
            <Table
              rowKey="value"
              pagination={false}
              dataSource={STUDENT_STATUSES.map((s) => ({ ...s, count: data.byStatus[s.value] ?? 0 }))}
              columns={[
                { title: "Trạng thái", render: (_: unknown, s: { label: string; color: string }) => <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span> },
                { title: "Số học sinh", dataIndex: "count", align: "right" as const },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Nghỉ học theo lý do" style={{ borderRadius: 8 }}>
            <Table
              rowKey="reason"
              pagination={false}
              dataSource={data.quitReasons}
              locale={{ emptyText: "Không có học sinh nghỉ trong tháng." }}
              columns={[
                { title: "Lý do", dataIndex: "reason" },
                { title: "Số học sinh", dataIndex: "count", align: "right" as const },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={`Ghi danh mới (${data.newEnrollments.length})`} style={{ borderRadius: 8 }}>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={data.newEnrollments}
              locale={{ emptyText: "Chưa có ghi danh mới." }}
              columns={[
                { title: "Ngày", render: (_: unknown, e: Data["newEnrollments"][number]) => formatDateVN(e.joinedAt) },
                { title: "Học sinh", render: (_: unknown, e: Data["newEnrollments"][number]) => studentLink(e.student) },
                { title: "Khóa / lớp", render: (_: unknown, e: Data["newEnrollments"][number]) => `${e.courseName} · ${e.classCode}` },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={`Bảo lưu mới (${data.reservations.length})`} style={{ borderRadius: 8 }}>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={data.reservations}
              locale={{ emptyText: "Không có bảo lưu mới." }}
              columns={[
                { title: "Học sinh", render: (_: unknown, x: Data["reservations"][number]) => studentLink(x.student) },
                { title: "Từ", render: (_: unknown, x: Data["reservations"][number]) => formatDateVN(x.startDate) },
                { title: "Dự kiến quay lại", render: (_: unknown, x: Data["reservations"][number]) => formatDateVN(x.expectedReturn) },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <div className="sub" style={{ marginTop: 12 }}>
        Tỷ lệ học tiếp: trong các học sinh học đến hết một lớp kết thúc trong tháng, bao nhiêu em đã có ghi danh khóa mới.
      </div>
    </div>
  );
}
