"use client";

import { useEffect, useState } from "react";
import { CheckOutlined, LockOutlined, PlusOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Dropdown, Row, Select, Space, Table, Tag, message } from "antd";
import dayjs from "dayjs";
import { api, qs } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useSession } from "@/client/session";
import { AdjustmentModal } from "@/components/payroll/AdjustmentModal";
import { SessionDetailModal } from "@/components/payroll/SessionDetailModal";
import { formatCurrency } from "@/lib/finance";
import { formatHours, payrollStatusOption } from "@/lib/payroll";
import { isManager } from "@/lib/permissions";
import { todayISO } from "@/lib/dates";

export default function PayrollPage() {
  const { centers, centerId } = useCenters();
  const { viewer } = useSession();

  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState<string>(todayISO().slice(0, 7));
  const [payrollList, setPayrollList] = useState<any[]>([]);

  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    teacherId: number | null;
    teacherName?: string;
    isLocked?: boolean;
  }>({ open: false, teacherId: null });

  const [adjustmentModal, setAdjustmentModal] = useState<{
    open: boolean;
    periodId: number | null;
    teacherName?: string;
  }>({ open: false, periodId: null });

  const loadPayroll = async () => {
    setLoading(true);
    try {
      const query = qs({
        month,
        centerId: centerId || undefined,
      });
      const data = await api.get<any[]>(`/api/payroll${query}`);
      setPayrollList(data);
    } catch (err: any) {
      message.error(err.message || "Không thể tải bảng lương tháng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, [month, centerId]);

  const handleLock = async (periodId: number) => {
    try {
      await api.post(`/api/payroll/${periodId}/lock`, {});
      message.success("Đã chốt bảng lương thành công");
      loadPayroll();
    } catch (err: any) {
      message.error(err.message || "Không thể chốt bảng lương");
    }
  };

  const handlePay = async (periodId: number) => {
    try {
      await api.post(`/api/payroll/${periodId}/pay`, {});
      message.success("Đã đánh dấu đã thanh toán lương");
      loadPayroll();
    } catch (err: any) {
      message.error(err.message || "Không thể cập nhật trạng thái thanh toán");
    }
  };

  const totalPayroll = payrollList.reduce((s, p) => s + (p.period?.finalPay ?? 0), 0);
  const totalHours = payrollList.reduce((s, p) => s + (p.period?.totalHours ?? 0), 0);
  const paidCount = payrollList.filter((p) => p.period?.status === "PAID").length;

  const columns = [
    {
      title: "Giáo viên / Trợ giảng",
      key: "teacher",
      render: (_: any, row: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.teacher.fullName}</div>
          <div style={{ fontSize: 12, color: "#8C959F" }}>
            {row.teacher.displayName} ({row.teacher.code})
          </div>
        </div>
      ),
    },
    {
      title: "Vai trò",
      dataIndex: ["teacher", "role"],
      key: "role",
      render: (role: string) => (
        <Tag color={role === "TEACHER" ? "blue" : role === "ASSISTANT" ? "purple" : "cyan"}>
          {role === "TEACHER" ? "Giáo viên" : role === "ASSISTANT" ? "Trợ giảng" : "Cả hai"}
        </Tag>
      ),
    },
    {
      title: "Số buổi",
      dataIndex: "sessionsCount",
      key: "sessionsCount",
      align: "center" as const,
      render: (count: number) => <span style={{ fontWeight: 600 }}>{count} buổi</span>,
    },
    {
      title: "Số giờ dạy",
      key: "totalHours",
      align: "right" as const,
      render: (_: any, row: any) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatHours(row.period?.totalHours ?? 0)}
        </span>
      ),
    },
    {
      title: "Tiền dạy",
      key: "teachingPay",
      align: "right" as const,
      render: (_: any, row: any) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCurrency(row.period?.teachingPay ?? 0)}
        </span>
      ),
    },
    {
      title: "Điều chỉnh",
      key: "adjustments",
      align: "right" as const,
      render: (_: any, row: any) => {
        const bonus = row.period?.bonusPay ?? 0;
        const allowance = row.period?.allowancePay ?? 0;
        const penalty = row.period?.penaltyPay ?? 0;
        const net = bonus + allowance - penalty;
        return (
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              color: net > 0 ? "#2DA44E" : net < 0 ? "#CF222E" : "#8C959F",
            }}
          >
            {net > 0 ? `+${formatCurrency(net)}` : net < 0 ? `-${formatCurrency(Math.abs(net))}` : "0 ₫"}
          </span>
        );
      },
    },
    {
      title: "Thực nhận",
      key: "finalPay",
      align: "right" as const,
      render: (_: any, row: any) => (
        <span
          style={{
            fontWeight: 800,
            fontSize: 15,
            fontVariantNumeric: "tabular-nums",
            color: "#1F6FEB",
          }}
        >
          {formatCurrency(row.period?.finalPay ?? 0)}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (_: any, row: any) => {
        const opt = payrollStatusOption(row.period?.status ?? "DRAFT");
        return <Tag color={opt?.color}>{opt?.label ?? row.period?.status}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "center" as const,
      render: (_: any, row: any) => {
        const period = row.period;
        const isLocked = period?.status === "LOCKED" || period?.status === "PAID";
        const isPaid = period?.status === "PAID";

        const items = [
          {
            key: "details",
            icon: <UnorderedListOutlined />,
            label: "Xem chi tiết buổi dạy",
            onClick: () =>
              setDetailModal({
                open: true,
                teacherId: row.teacher.id,
                teacherName: row.teacher.fullName,
                isLocked,
              }),
          },
          ...(!isLocked
            ? [
                {
                  key: "adj",
                  icon: <PlusOutlined />,
                  label: "Thêm thưởng / phạt",
                  onClick: () =>
                    setAdjustmentModal({
                      open: true,
                      periodId: period?.id,
                      teacherName: row.teacher.fullName,
                    }),
                },
              ]
            : []),
          ...(viewer && isManager(viewer) && !isLocked
            ? [
                {
                  key: "lock",
                  icon: <LockOutlined />,
                  label: "Chốt lương tháng",
                  onClick: () => handleLock(period.id),
                },
              ]
            : []),
          ...(viewer && isManager(viewer) && isLocked && !isPaid
            ? [
                {
                  key: "pay",
                  icon: <CheckOutlined />,
                  label: "Đánh dấu đã trả lương",
                  onClick: () => handlePay(period.id),
                },
              ]
            : []),
        ];

        return (
          <Dropdown menu={{ items }}>
            <Button size="small">⋯</Button>
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px 0" }}>Bảng lương giáo viên & trợ giảng</h1>
          <div style={{ color: "#59636E" }}>
            Tự động tổng hợp giờ dạy theo buổi thực tế, xử lý trùng giờ và chốt lương hàng tháng
          </div>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "#59636E", fontSize: 13 }}>Tổng quỹ lương tháng {month}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1F6FEB", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(totalPayroll)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "#59636E", fontSize: 13 }}>Tổng giờ dạy thực tế</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#2DA44E", fontVariantNumeric: "tabular-nums" }}>
              {formatHours(totalHours)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div style={{ color: "#59636E", fontSize: 13 }}>Đã thanh toán</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1F2328", fontVariantNumeric: "tabular-nums" }}>
              {paidCount} / {payrollList.length} người
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>Tháng tính lương:</span>
          <DatePicker
            picker="month"
            value={dayjs(month, "YYYY-MM")}
            onChange={(d) => setMonth(d ? d.format("YYYY-MM") : todayISO().slice(0, 7))}
            format="MM/YYYY"
            allowClear={false}
          />
        </Space>
      </Card>

      <Table
        dataSource={payrollList}
        columns={columns}
        rowKey={(r) => r.teacher.id}
        loading={loading}
        pagination={{ pageSize: 15 }}
      />

      <SessionDetailModal
        open={detailModal.open}
        teacherId={detailModal.teacherId}
        teacherName={detailModal.teacherName}
        month={month}
        isLocked={detailModal.isLocked}
        onClose={() => setDetailModal({ open: false, teacherId: null })}
        onAdjustmentChange={loadPayroll}
      />

      <AdjustmentModal
        open={adjustmentModal.open}
        payrollPeriodId={adjustmentModal.periodId}
        teacherName={adjustmentModal.teacherName}
        onClose={() => setAdjustmentModal({ open: false, periodId: null })}
        onSuccess={loadPayroll}
      />
    </div>
  );
}
