"use client";

import { useEffect, useState } from "react";
import { DownloadOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Row, Select, Space, Table, Tabs, Tag, message } from "antd";
import dayjs from "dayjs";
import { api, qs } from "@/client/api";
import { useCenters } from "@/client/centers";
import { downloadCsv } from "@/client/csv";
import { formatCurrency } from "@/lib/finance";
import { formatHours } from "@/lib/payroll";
import { todayISO } from "@/lib/dates";

export default function ReportsPage() {
  const { centers, centerId } = useCenters();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [month, setMonth] = useState<string>(todayISO().slice(0, 7));

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<any>(null);
  // Revenue state
  const [revenueData, setRevenueData] = useState<any>(null);
  // Profit-Loss state
  const [profitLossData, setProfitLossData] = useState<any>(null);
  // Teachers state
  const [teachersData, setTeachersData] = useState<any>(null);
  // Attendance state
  const [attendanceData, setAttendanceData] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "dashboard") {
        const query = qs({ centerId: centerId || undefined });
        const res = await api.get<any>(`/api/reports/dashboard${query}`);
        setDashboardData(res);
      } else if (activeTab === "revenue") {
        const query = qs({ centerId: centerId || undefined, fromMonth: month, toMonth: month });
        const res = await api.get<any>(`/api/reports/revenue${query}`);
        setRevenueData(res);
      } else if (activeTab === "profit-loss") {
        const query = qs({ centerId: centerId || undefined, month });
        const res = await api.get<any>(`/api/reports/profit-loss${query}`);
        setProfitLossData(res);
      } else if (activeTab === "teachers") {
        const query = qs({ centerId: centerId || undefined, month });
        const res = await api.get<any>(`/api/reports/teachers${query}`);
        setTeachersData(res);
      } else if (activeTab === "attendance") {
        const query = qs({ centerId: centerId || undefined });
        const res = await api.get<any>(`/api/reports/attendance${query}`);
        setAttendanceData(res);
      }
    } catch (err: any) {
      message.error(err.message || "Không thể tải số liệu báo cáo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, month, centerId]);

  // Export functions
  const exportRevenue = () => {
    if (!revenueData?.byCenter) return;
    const header = ["Trung tâm", "Thực thu", "Hoàn tiền", "Doanh thu thuần", "Tiền mặt", "Chuyển khoản"];
    const rows = revenueData.byCenter.map((c: any) => [
      c.center.name,
      c.paidTotal,
      c.refundTotal,
      c.netRevenue,
      c.cashPaid,
      c.transferPaid,
    ]);
    downloadCsv(`Bao_cao_doanh_thu_${month}.csv`, header, rows);
  };

  const exportProfitLoss = () => {
    if (!profitLossData?.byCenter) return;
    const header = ["Trung tâm", "Thực thu", "Hoàn tiền", "Doanh thu thuần", "Lương GV/TG", "Chi phí", "Lãi / Lỗ", "Tỷ suất (%)"];
    const rows = profitLossData.byCenter.map((c: any) => [
      c.center.name,
      c.revenue,
      c.refund,
      c.netRevenue,
      c.teacherPayroll,
      c.expenses,
      c.profit,
      `${c.margin}%`,
    ]);
    downloadCsv(`Bao_cao_lai_lo_${month}.csv`, header, rows);
  };

  const exportTeachers = () => {
    if (!teachersData?.items) return;
    const header = ["Họ tên", "Mã", "Vai trò", "Trung tâm", "Tổng buổi", "Buổi chính", "Dạy thay", "Trợ giảng", "Tổng giờ", "Lương"];
    const rows = teachersData.items.map((t: any) => [
      t.teacher.fullName,
      t.teacher.code,
      t.teacher.role,
      t.centers,
      t.totalSessions,
      t.mainSessionsCount,
      t.substituteSessionsCount,
      t.assistantSessionsCount,
      t.totalHours,
      t.totalSalary,
    ]);
    downloadCsv(`Bao_cao_giao_vien_${month}.csv`, header, rows);
  };

  const exportAttendance = () => {
    if (!attendanceData?.items) return;
    const header = ["Lớp học", "Mã lớp", "Trung tâm", "Sĩ số", "Số buổi", "Có mặt", "Đi muộn", "Vắng có phép", "Vắng không phép", "Tỷ lệ đi học (%)"];
    const rows = attendanceData.items.map((c: any) => [
      c.class.name,
      c.class.code,
      c.class.centerName,
      c.studentsCount,
      c.sessionsRecorded,
      c.present,
      c.late,
      c.excused,
      c.unexcused,
      `${c.attendanceRate}%`,
    ]);
    downloadCsv(`Bao_cao_chuyen_can.csv`, header, rows);
  };

  return (
    <div style={{ padding: "0 0 32px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px 0" }}>Báo cáo & Thống kê hệ thống</h1>
          <div style={{ color: "#59636E" }}>Số liệu tổng hợp 4 trung tâm: hôm nay, doanh thu, lãi lỗ, giáo viên và chuyên cần</div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "dashboard", label: "Tổng quan hôm nay" },
          { key: "revenue", label: "Doanh thu & Thực thu" },
          { key: "profit-loss", label: "Lãi / Lỗ theo trung tâm" },
          { key: "teachers", label: "Giáo viên & Giờ dạy" },
          { key: "attendance", label: "Chuyên cần học sinh" },
        ]}
      />

      {/* Bộ lọc tháng cho các tab cần thời gian */}
      {activeTab !== "dashboard" && activeTab !== "attendance" && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <span>Tháng báo cáo:</span>
            <DatePicker
              picker="month"
              value={dayjs(month, "YYYY-MM")}
              onChange={(d) => setMonth(d ? d.format("YYYY-MM") : todayISO().slice(0, 7))}
              format="MM/YYYY"
              allowClear={false}
            />
          </Space>
        </Card>
      )}

      {/* TAB 1: DASHBOARD HÔM NAY */}
      {activeTab === "dashboard" && (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Số buổi học hôm nay</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1F6FEB", fontVariantNumeric: "tabular-nums" }}>
                  {dashboardData?.sessionsCount ?? 0} buổi
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Đã điểm danh</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#2DA44E", fontVariantNumeric: "tabular-nums" }}>
                  {dashboardData?.takenSessions ?? 0} / {dashboardData?.sessionsCount ?? 0} buổi
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Lượt học sinh có mặt</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#2DA44E", fontVariantNumeric: "tabular-nums" }}>
                  {dashboardData?.attendance?.present ?? 0} ({dashboardData?.attendance?.late ?? 0} muộn)
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Tiền thu trong ngày</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#2DA44E", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(dashboardData?.revenueToday ?? 0)}
                </div>
              </Card>
            </Col>
          </Row>

          <Card size="small" title="Lịch các buổi học hôm nay" style={{ borderRadius: 8 }}>
            <Table
              dataSource={dashboardData?.sessionsList ?? []}
              rowKey="id"
              loading={loading}
              pagination={false}
              columns={[
                {
                  title: "Giờ",
                  render: (_: any, r: any) => `${r.startTime}–${r.endTime}`,
                },
                {
                  title: "Lớp học",
                  render: (_: any, r: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.className}</div>
                      <div style={{ fontSize: 12, color: "#8C959F" }}>{r.classCode}</div>
                    </div>
                  ),
                },
                {
                  title: "Trung tâm & Phòng",
                  render: (_: any, r: any) => (
                    <div>
                      <Tag color={r.centerColor}>{r.centerName}</Tag>
                      <span>{r.roomName}</span>
                    </div>
                  ),
                },
                {
                  title: "Giáo viên",
                  dataIndex: "teacherName",
                },
                {
                  title: "Điểm danh",
                  render: (_: any, r: any) =>
                    r.attendanceTaken ? (
                      <Tag color="success">Đã điểm danh ({r.attendees} HS)</Tag>
                    ) : (
                      <Tag color="warning">Chưa điểm danh</Tag>
                    ),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {/* TAB 2: DOANH THU & THỰC THU */}
      {activeTab === "revenue" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={exportRevenue}>
              Xuất Excel (CSV)
            </Button>
          </div>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Tổng thực thu</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#2DA44E", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(revenueData?.summary?.totalPaid ?? 0)}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Tổng hoàn tiền</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#CF222E", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(revenueData?.summary?.totalRefund ?? 0)}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Doanh thu thuần (Net)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1F6FEB", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(revenueData?.summary?.totalNet ?? 0)}
                </div>
              </Card>
            </Col>
          </Row>

          <Card size="small" title={`Doanh thu chi tiết theo trung tâm - Tháng ${month}`} style={{ borderRadius: 8 }}>
            <Table
              dataSource={revenueData?.byCenter ?? []}
              rowKey={(r) => r.center.id}
              loading={loading}
              pagination={false}
              columns={[
                {
                  title: "Trung tâm",
                  render: (_: any, r: any) => <Tag color={r.center.color}>{r.center.name}</Tag>,
                },
                {
                  title: "Số phiếu thu",
                  dataIndex: "paymentCount",
                  align: "center" as const,
                },
                {
                  title: "Thực thu",
                  dataIndex: "paidTotal",
                  align: "right" as const,
                  render: (v: number) => (
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#2DA44E" }}>
                      {formatCurrency(v)}
                    </span>
                  ),
                },
                {
                  title: "Hoàn tiền",
                  dataIndex: "refundTotal",
                  align: "right" as const,
                  render: (v: number) => (
                    <span style={{ fontVariantNumeric: "tabular-nums", color: "#CF222E" }}>
                      {formatCurrency(v)}
                    </span>
                  ),
                },
                {
                  title: "Doanh thu thuần",
                  dataIndex: "netRevenue",
                  align: "right" as const,
                  render: (v: number) => (
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#1F6FEB" }}>
                      {formatCurrency(v)}
                    </span>
                  ),
                },
                {
                  title: "Tiền mặt",
                  dataIndex: "cashPaid",
                  align: "right" as const,
                  render: (v: number) => formatCurrency(v),
                },
                {
                  title: "Chuyển khoản",
                  dataIndex: "transferPaid",
                  align: "right" as const,
                  render: (v: number) => formatCurrency(v),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {/* TAB 3: LÃI LỖ THEO TRUNG TÂM */}
      {activeTab === "profit-loss" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={exportProfitLoss}>
              Xuất Excel (CSV)
            </Button>
          </div>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Doanh thu thuần</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1F6FEB", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(profitLossData?.summary?.netRevenue ?? 0)}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Chi lương GV/TG</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#D29922", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(profitLossData?.summary?.teacherPayroll ?? 0)}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Chi phí hoạt động</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#CF222E", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(profitLossData?.summary?.expenses ?? 0)}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ color: "#59636E", fontSize: 13 }}>Lợi nhuận ròng</div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: (profitLossData?.summary?.profit ?? 0) >= 0 ? "#2DA44E" : "#CF222E",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCurrency(profitLossData?.summary?.profit ?? 0)}
                </div>
              </Card>
            </Col>
          </Row>

          <Card size="small" title={`Bảng phân tích Lãi / Lỗ 4 trung tâm - Tháng ${month}`} style={{ borderRadius: 8 }}>
            <Table
              dataSource={profitLossData?.byCenter ?? []}
              rowKey={(r) => r.center.id}
              loading={loading}
              pagination={false}
              columns={[
                {
                  title: "Trung tâm",
                  render: (_: any, r: any) => <Tag color={r.center.color}>{r.center.name}</Tag>,
                },
                {
                  title: "Thực thu",
                  dataIndex: "revenue",
                  align: "right" as const,
                  render: (v: number) => formatCurrency(v),
                },
                {
                  title: "Hoàn tiền",
                  dataIndex: "refund",
                  align: "right" as const,
                  render: (v: number) => formatCurrency(v),
                },
                {
                  title: "Doanh thu thuần",
                  dataIndex: "netRevenue",
                  align: "right" as const,
                  render: (v: number) => (
                    <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>
                  ),
                },
                {
                  title: "Lương GV/TG",
                  dataIndex: "teacherPayroll",
                  align: "right" as const,
                  render: (v: number) => (
                    <span style={{ color: "#D29922" }}>{formatCurrency(v)}</span>
                  ),
                },
                {
                  title: "Chi phí hoạt động",
                  dataIndex: "expenses",
                  align: "right" as const,
                  render: (v: number) => (
                    <span style={{ color: "#CF222E" }}>{formatCurrency(v)}</span>
                  ),
                },
                {
                  title: "Lãi / Lỗ",
                  dataIndex: "profit",
                  align: "right" as const,
                  render: (v: number) => (
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        fontVariantNumeric: "tabular-nums",
                        color: v >= 0 ? "#2DA44E" : "#CF222E",
                      }}
                    >
                      {formatCurrency(v)}
                    </span>
                  ),
                },
                {
                  title: "Biên lợi nhuận",
                  dataIndex: "margin",
                  align: "center" as const,
                  render: (m: number) => (
                    <Tag color={m >= 30 ? "green" : m >= 10 ? "blue" : m >= 0 ? "orange" : "red"}>
                      {m}%
                    </Tag>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {/* TAB 4: GIÁO VIÊN & GIỜ DẠY */}
      {activeTab === "teachers" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={exportTeachers}>
              Xuất Excel (CSV)
            </Button>
          </div>

          <Card size="small" title={`Tổng hợp giờ dạy và lương giáo viên - Tháng ${month}`} style={{ borderRadius: 8 }}>
            <Table
              dataSource={teachersData?.items ?? []}
              rowKey={(r) => r.teacher.id}
              loading={loading}
              pagination={false}
              columns={[
                {
                  title: "Họ và tên",
                  key: "name",
                  render: (_: any, r: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.teacher.fullName}</div>
                      <div style={{ fontSize: 12, color: "#8C959F" }}>
                        {r.teacher.displayName} ({r.teacher.code})
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Trung tâm",
                  dataIndex: "centers",
                },
                {
                  title: "Tổng số buổi",
                  dataIndex: "totalSessions",
                  align: "center" as const,
                  render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
                },
                {
                  title: "Dạy chính",
                  dataIndex: "mainSessionsCount",
                  align: "center" as const,
                },
                {
                  title: "Dạy thay",
                  dataIndex: "substituteSessionsCount",
                  align: "center" as const,
                  render: (v: number) => (v > 0 ? <Tag color="purple">{v}</Tag> : "0"),
                },
                {
                  title: "Trợ giảng",
                  dataIndex: "assistantSessionsCount",
                  align: "center" as const,
                },
                {
                  title: "Tổng giờ dạy",
                  dataIndex: "totalHours",
                  align: "right" as const,
                  render: (h: number) => (
                    <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {formatHours(h)}
                    </span>
                  ),
                },
                {
                  title: "Tổng lương",
                  dataIndex: "totalSalary",
                  align: "right" as const,
                  render: (s: number) => (
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#1F6FEB" }}>
                      {formatCurrency(s)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {/* TAB 5: CHUYÊN CẦN */}
      {activeTab === "attendance" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={exportAttendance}>
              Xuất Excel (CSV)
            </Button>
          </div>

          <Card size="small" title="Báo cáo chuyên cần và tỷ lệ đi học theo lớp" style={{ borderRadius: 8 }}>
            <Table
              dataSource={attendanceData?.items ?? []}
              rowKey={(r) => r.class.id}
              loading={loading}
              pagination={{ pageSize: 50, showSizeChanger: true }}
              columns={[
                {
                  title: "Lớp học",
                  render: (_: any, r: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.class.name}</div>
                      <div style={{ fontSize: 12, color: "#8C959F" }}>
                        {r.class.code} ({r.class.centerName})
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Sĩ số",
                  dataIndex: "studentsCount",
                  align: "center" as const,
                },
                {
                  title: "Số buổi đã ghi",
                  dataIndex: "sessionsRecorded",
                  align: "center" as const,
                },
                {
                  title: "Có mặt",
                  dataIndex: "present",
                  align: "center" as const,
                  render: (v: number) => <span style={{ color: "#2DA44E", fontWeight: 600 }}>{v}</span>,
                },
                {
                  title: "Đi muộn",
                  dataIndex: "late",
                  align: "center" as const,
                  render: (v: number) => (v > 0 ? <span style={{ color: "#D29922" }}>{v}</span> : "0"),
                },
                {
                  title: "Vắng có phép",
                  dataIndex: "excused",
                  align: "center" as const,
                  render: (v: number) => (v > 0 ? <span style={{ color: "#1F6FEB" }}>{v}</span> : "0"),
                },
                {
                  title: "Vắng không phép",
                  dataIndex: "unexcused",
                  align: "center" as const,
                  render: (v: number) => (v > 0 ? <span style={{ color: "#CF222E", fontWeight: 600 }}>{v}</span> : "0"),
                },
                {
                  title: "Tỷ lệ đi học",
                  dataIndex: "attendanceRate",
                  align: "center" as const,
                  render: (rate: number) => (
                    <Tag color={rate >= 90 ? "green" : rate >= 75 ? "blue" : "red"}>
                      {rate}%
                    </Tag>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
