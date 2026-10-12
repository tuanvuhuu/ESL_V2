"use client";

import { useEffect, useState } from "react";
import { DatePicker, message } from "@/client/primer-compat";
import type { ColumnsType } from "@/client/primer-compat";
import dayjs from "dayjs";
import { api, qs } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useSession } from "@/client/session";
import { ActionMenu, DotLabel, PageHeader } from "@/components/ui";
import { AdjustmentModal } from "@/components/payroll/AdjustmentModal";
import { SessionDetailModal, type PayrollPeriodRow } from "@/components/payroll/SessionDetailModal";
import { PrimerGrid } from "@/components/PrimerGrid";
import { formatCurrency } from "@/lib/finance";
import { formatHours, payrollStatusOption } from "@/lib/payroll";
import { isManager } from "@/lib/permissions";
import { todayISO } from "@/lib/dates";

/** Một dòng của GET /api/payroll (src/server/payroll.ts › generateOrGetMonthlyPayroll). */
type PayrollRow = {
  period: PayrollPeriodRow;
  teacher: { id: number; fullName: string; displayName: string; code: string; role: string };
  sessionsCount: number;
};

export default function PayrollPage() {
  const { centers, centerId } = useCenters();
  const { viewer } = useSession();

  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState<string>(todayISO().slice(0, 7));
  const [payrollList, setPayrollList] = useState<PayrollRow[]>([]);

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
      const data = await api.get<PayrollRow[]>(`/api/payroll${query}`);
      setPayrollList(data);
    } catch (err) {
      message.error((err as Error).message || "Không thể tải bảng lương tháng");
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
    } catch (err) {
      message.error((err as Error).message || "Không thể chốt bảng lương");
    }
  };

  const handlePay = async (periodId: number) => {
    try {
      await api.post(`/api/payroll/${periodId}/pay`, {});
      message.success("Đã đánh dấu đã thanh toán lương");
      loadPayroll();
    } catch (err) {
      message.error((err as Error).message || "Không thể cập nhật trạng thái thanh toán");
    }
  };

  const totalPayroll = payrollList.reduce((s, p) => s + (p.period?.finalPay ?? 0), 0);
  const totalHours = payrollList.reduce((s, p) => s + (p.period?.totalHours ?? 0), 0);
  const paidCount = payrollList.filter((p) => p.period?.status === "PAID").length;

  const columns: ColumnsType<PayrollRow> = [
    {
      title: "Giáo viên / Trợ giảng",
      key: "teacher",
      render: (_, row) => (
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
      render: (role: string) => {
        const color = role === "TEACHER" ? "#0969DA" : role === "ASSISTANT" ? "#8250DF" : "#1A7F37";
        return (
          <DotLabel color={color}>
            {role === "TEACHER" ? "Giáo viên" : role === "ASSISTANT" ? "Trợ giảng" : "Cả hai"}
          </DotLabel>
        );
      },
    },
    {
      title: "Số buổi",
      dataIndex: "sessionsCount",
      key: "sessionsCount",
      align: "center",
      render: (count: number) => <span style={{ fontWeight: 600 }}>{count} buổi</span>,
    },
    {
      title: "Số giờ dạy",
      key: "totalHours",
      align: "right",
      render: (_, row) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatHours(row.period?.totalHours ?? 0)}
        </span>
      ),
    },
    {
      title: "Tiền dạy",
      key: "teachingPay",
      align: "right",
      render: (_, row) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCurrency(row.period?.teachingPay ?? 0)}
        </span>
      ),
    },
    {
      title: "Điều chỉnh",
      key: "adjustments",
      align: "right",
      render: (_, row) => {
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
      align: "right",
      render: (_, row) => (
        <span
          style={{
            fontWeight: 800,
            fontSize: 14,
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
      render: (_, row) => {
        const opt = payrollStatusOption(row.period?.status ?? "DRAFT");
        const dotColor =
          row.period?.status === "PAID"
            ? "#2DA44E"
            : row.period?.status === "LOCKED"
            ? "#1F6FEB"
            : "#D29922";
        return <DotLabel color={dotColor}>{opt?.label ?? row.period?.status}</DotLabel>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "center",
      render: (_, row) => {
        const period = row.period;
        const isLocked = period?.status === "LOCKED" || period?.status === "PAID";
        const isPaid = period?.status === "PAID";

        const items: Array<{
          key: string;
          label: string;
          danger?: boolean;
          onClick?: () => void;
        }> = [
          {
            key: "details",
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
                  label: "Chốt lương tháng",
                  onClick: () => handleLock(period.id),
                },
              ]
            : []),
          ...(viewer && isManager(viewer) && isLocked && !isPaid
            ? [
                {
                  key: "pay",
                  label: "Đánh dấu đã trả lương",
                  onClick: () => handlePay(period.id),
                },
              ]
            : []),
        ];

        return <ActionMenu items={items} title={row.teacher.fullName} />;
      },
    },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <PageHeader
        title="Bảng lương giáo viên & trợ giảng"
        description="Tự động tổng hợp giờ dạy theo buổi thực tế, xử lý trùng giờ và chốt lương hàng tháng"
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            padding: "8px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13, color: "#59636E" }}>Tháng tính lương:</span>
          <DatePicker
            picker="month"
            value={dayjs(month, "YYYY-MM")}
            onChange={(d) => setMonth(d ? d.format("YYYY-MM") : todayISO().slice(0, 7))}
            format="MM/YYYY"
            allowClear={false}
            size="small"
          />
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            padding: "8px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "#59636E", fontSize: 13 }}>Tổng quỹ lương:</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1F6FEB", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(totalPayroll)}
          </span>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            padding: "8px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "#59636E", fontSize: 13 }}>Tổng giờ dạy:</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#2DA44E", fontVariantNumeric: "tabular-nums" }}>
            {formatHours(totalHours)}
          </span>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            padding: "8px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "#59636E", fontSize: 13 }}>Đã thanh toán:</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2328", fontVariantNumeric: "tabular-nums" }}>
            {paidCount} / {payrollList.length} người
          </span>
        </div>
      </div>

      <PrimerGrid<PayrollRow>
        dataSource={payrollList}
        columns={columns}
        rowKey={(r) => r.teacher.id}
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true }}
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
