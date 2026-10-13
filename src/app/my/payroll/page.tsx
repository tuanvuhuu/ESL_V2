"use client";

import { useEffect, useState } from "react";
import { Alert, Card, Col, DatePicker, Divider, Grid, Row, Space, Table, Tag, message } from "@/client/primer-compat";
import dayjs from "dayjs";
import { api } from "@/client/api";
import { useSession } from "@/client/session";
import { formatCurrency } from "@/lib/finance";
import { adjustmentTypeOption, formatHours, payrollStatusOption } from "@/lib/payroll";
import { formatDateVN, todayISO } from "@/lib/dates";

const { useBreakpoint } = Grid;

export default function MyPayrollPage() {
  const { viewer } = useSession();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState<string>(todayISO().slice(0, 7));
  const [data, setData] = useState<any>(null);

  const loadMyPayroll = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/api/my/payroll?month=${month}`);
      setData(res);
    } catch (err: any) {
      message.error(err.message || "Không thể tải thông tin lương");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyPayroll();
  }, [month]);

  const period = data?.period;
  const statusOpt = payrollStatusOption(period?.status ?? "DRAFT");
  const sessions = data?.sessions ?? [];
  const adjustments = period?.adjustments ?? [];

  return (
    <div style={{ padding: "0 0 32px 0" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px 0" }}>Bảng giờ dạy & Lương cá nhân</h1>
        <div style={{ color: "var(--fgColor-muted)" }}>
          Xem chi tiết số giờ dạy thực tế, các buổi dạy và mức lương tạm tính trong tháng
        </div>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>Chọn tháng:</span>
          <DatePicker
            picker="month"
            value={dayjs(month, "YYYY-MM")}
            onChange={(d) => setMonth(d ? d.format("YYYY-MM") : todayISO().slice(0, 7))}
            format="MM/YYYY"
            allowClear={false}
          />
          <span style={{ marginLeft: 16 }}>Trạng thái bảng lương:</span>
          <Tag color={statusOpt?.color} style={{ fontSize: 13, padding: "2px 8px" }}>
            {statusOpt?.label}
          </Tag>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Tổng số giờ</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-default)", fontVariantNumeric: "tabular-nums" }}>
              {formatHours(data?.totalHours ?? 0)}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Tiền dạy các buổi</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-success)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(data?.totalTeachingPay ?? 0)}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "var(--fgColor-muted)", fontSize: 13 }}>Thưởng / Phạt</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fgColor-attention)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency((period?.bonusPay ?? 0) + (period?.allowancePay ?? 0) - (period?.penaltyPay ?? 0))}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, background: "var(--bgColor-accent-muted)", borderColor: "var(--fgColor-accent)" }}>
            <div style={{ color: "var(--fgColor-accent)", fontSize: 13, fontWeight: 600 }}>Thực nhận</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--fgColor-accent)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(period?.finalPay ?? data?.totalTeachingPay ?? 0)}
            </div>
          </Card>
        </Col>
      </Row>

      {period?.status === "DRAFT" && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Bảng lương đang ở trạng thái Nháp. Số liệu sẽ được chốt chính thức vào cuối tháng bởi Quản lý."
        />
      )}

      {/* Hiển thị trên điện thoại: dạng thẻ / Mobile Cards */}
      {isMobile ? (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div style={{ fontWeight: 700, fontSize: 16 }}>Danh sách buổi dạy ({sessions.length})</div>
          {sessions.map((s: any) => (
            <Card key={s.id} size="small" style={{ borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <strong>{formatDateVN(s.date)}</strong>
                <span style={{ color: "var(--fgColor-accent)", fontWeight: 600 }}>{s.startTime}–{s.endTime}</span>
              </div>
              <div style={{ fontWeight: 600, color: "var(--fgColor-default)" }}>{s.className}</div>
              <div style={{ color: "var(--fgColor-muted)", fontSize: 12, marginBottom: 8 }}>
                {s.classCode} · {s.roomName} ({s.centerName})
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Tag color={s.role === "TEACHER" ? "blue" : "purple"}>
                    {s.role === "TEACHER" ? "Giáo viên" : "Trợ giảng"}
                  </Tag>
                  {s.isOverlapping && <Tag color="orange">Trùng giờ</Tag>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
                    {formatHours(s.hours)} × {formatCurrency(s.hourlyRate)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fgColor-success)", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(s.pay)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      ) : (
        /* Hiển thị trên máy tính: Table */
        <Card size="small" title={`Chi tiết các buổi dạy trong tháng (${sessions.length} buổi)`} style={{ borderRadius: 8 }}>
          <Table
            dataSource={sessions}
            rowKey="id"
            loading={loading}
            pagination={false}
            columns={[
              {
                title: "Ngày",
                dataIndex: "date",
                render: (d: string) => formatDateVN(d),
              },
              {
                title: "Giờ",
                render: (_: any, r: any) => `${r.startTime}–${r.endTime}`,
              },
              {
                title: "Lớp học",
                render: (_: any, r: any) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.className}</div>
                    <div style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
                      {r.classCode} · {r.roomName} ({r.centerName})
                    </div>
                  </div>
                ),
              },
              {
                title: "Vai trò",
                dataIndex: "role",
                render: (role: string) => (
                  <Tag color={role === "TEACHER" ? "blue" : "purple"}>
                    {role === "TEACHER" ? "Giáo viên" : "Trợ giảng"}
                  </Tag>
                ),
              },
              {
                title: "Số giờ",
                dataIndex: "hours",
                align: "right" as const,
                render: (h: number, r: any) => (
                  <div>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatHours(h)}</span>
                    {r.isOverlapping && (
                      <div>
                        <Tag color="orange" style={{ fontSize: 11 }}>
                          Trùng giờ
                        </Tag>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: "Đơn giá",
                dataIndex: "hourlyRate",
                align: "right" as const,
                render: (rate: number) => (
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(rate)}/h</span>
                ),
              },
              {
                title: "Thành tiền",
                dataIndex: "pay",
                align: "right" as const,
                render: (pay: number) => (
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--fgColor-success)" }}>
                    {formatCurrency(pay)}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}

      {adjustments.length > 0 && (
        <Card size="small" title="Các khoản điều chỉnh thưởng / phạt" style={{ marginTop: 20, borderRadius: 8 }}>
          <Table
            dataSource={adjustments}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: "Khoản mục",
                dataIndex: "type",
                render: (t: string) => {
                  const opt = adjustmentTypeOption(t);
                  return <Tag color={opt?.color}>{opt?.label ?? t}</Tag>;
                },
              },
              {
                title: "Lý do",
                dataIndex: "note",
              },
              {
                title: "Số tiền",
                dataIndex: "amount",
                align: "right" as const,
                render: (val: number, r: any) => (
                  <span
                    style={{
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: r.type === "PENALTY" ? "var(--fgColor-danger)" : "var(--fgColor-success)",
                    }}
                  >
                    {r.type === "PENALTY" ? "-" : "+"}
                    {formatCurrency(val)}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
