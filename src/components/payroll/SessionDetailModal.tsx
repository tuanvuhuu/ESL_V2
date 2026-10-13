"use client";

import { useEffect, useState } from "react";
import { DeleteOutlined } from "@/client/primer-icons";
import { Button, Descriptions, Divider, Modal, Popconfirm, Table, Tag, message } from "@/client/primer-compat";
import type { ColumnsType } from "@/client/primer-compat";
import { api } from "@/client/api";
import { formatCurrency } from "@/lib/finance";
import { adjustmentTypeOption, formatHours, type AdjustmentType, type TeachingRole } from "@/lib/payroll";
import { formatDateVN } from "@/lib/dates";

/** Một buổi dạy đã tính tiền, dùng cho bảng chi tiết lương. */
export type PayrollSessionRow = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  className: string;
  classCode: string;
  centerName: string;
  roomName: string;
  role: TeachingRole;
  hourlyRate: number;
  durationMinutes: number;
  hours: number;
  isOverlapping: boolean;
  pay: number;
};

/** Khoản thưởng / phụ cấp / phạt của kỳ lương. */
export type PayrollAdjustmentRow = {
  id: number;
  payrollPeriodId: number;
  type: AdjustmentType;
  amount: number;
  note: string;
  createdBy: string;
};

/** Bảng lương tháng của một giáo viên (null khi tháng đó chưa có bảng lương). */
export type PayrollPeriodRow = {
  id: number;
  month: string;
  teacherId: number;
  centerId: number | null;
  status: string;
  totalHours: number;
  teachingPay: number;
  bonusPay: number;
  allowancePay: number;
  penaltyPay: number;
  finalPay: number;
  adjustments: PayrollAdjustmentRow[];
};

/** Kết quả GET /api/my/payroll (src/server/payroll.ts › getTeacherMonthlyDetails). */
export type PayrollDetail = {
  month: string;
  period: PayrollPeriodRow | null;
  sessions: PayrollSessionRow[];
  totalHours: number;
  totalTeachingPay: number;
};

export function SessionDetailModal({
  open,
  teacherId,
  teacherName,
  month,
  isLocked,
  onClose,
  onAdjustmentChange,
}: {
  open: boolean;
  teacherId: number | null;
  teacherName?: string;
  month: string;
  isLocked?: boolean;
  onClose: () => void;
  onAdjustmentChange: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PayrollDetail | null>(null);

  const loadDetails = async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const res = await api.get<PayrollDetail>(`/api/my/payroll?month=${month}&teacherId=${teacherId}`);
      setData(res);
    } catch (err) {
      message.error((err as Error).message || "Không thể tải chi tiết giờ dạy");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && teacherId) {
      loadDetails();
    }
  }, [open, teacherId, month]);

  const handleDeleteAdjustment = async (id: number) => {
    try {
      await api.delete(`/api/payroll/adjustments/${id}`);
      message.success("Đã xóa khoản điều chỉnh");
      loadDetails();
      onAdjustmentChange();
    } catch (err) {
      message.error((err as Error).message || "Không thể xóa điều chỉnh");
    }
  };

  const sessionColumns: ColumnsType<PayrollSessionRow> = [
    {
      title: "Ngày",
      dataIndex: "date",
      key: "date",
      render: (d: string) => formatDateVN(d),
    },
    {
      title: "Thời gian",
      key: "time",
      render: (_, r) => `${r.startTime}–${r.endTime}`,
    },
    {
      title: "Lớp & Phòng",
      key: "class",
      render: (_, r) => (
        <span>
          <strong>{r.className}</strong>{" "}
          <span style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
            {r.classCode} · {r.roomName} ({r.centerName})
          </span>
        </span>
      ),
    },
    {
      title: "Vai trò",
      dataIndex: "role",
      key: "role",
      render: (role: TeachingRole) => (
        <Tag color={role === "TEACHER" ? "blue" : "purple"}>
          {role === "TEACHER" ? "Giáo viên" : "Trợ giảng"}
        </Tag>
      ),
    },
    {
      title: "Số giờ",
      dataIndex: "hours",
      key: "hours",
      align: "right",
      render: (h: number, r) => (
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
      key: "hourlyRate",
      align: "right",
      render: (rate: number) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(rate)}/h</span>
      ),
    },
    {
      title: "Thành tiền",
      dataIndex: "pay",
      key: "pay",
      align: "right",
      render: (pay: number) => (
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--fgColor-success)" }}>
          {formatCurrency(pay)}
        </span>
      ),
    },
  ];

  const adjustmentColumns: ColumnsType<PayrollAdjustmentRow> = [
    {
      title: "Loại",
      dataIndex: "type",
      render: (t: AdjustmentType) => {
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
      align: "right",
      render: (val: number, r) => (
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
    {
      title: "Thao tác",
      key: "action",
      align: "center",
      render: (_, r) =>
        !isLocked ? (
          <Popconfirm
            title="Xóa khoản điều chỉnh này?"
            onConfirm={() => handleDeleteAdjustment(r.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null,
    },
  ];

  const adjustments = data?.period?.adjustments ?? [];

  return (
    <Modal
      open={open}
      title={`Chi tiết bảng lương tháng ${month} - ${teacherName || ""}`}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Đóng
        </Button>,
      ]}
      width="min(1280px, calc(100vw - 48px))"
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={3} bordered>
          <Descriptions.Item label="Tổng số giờ dạy">
            <strong>{formatHours(data?.totalHours ?? 0)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Tiền dạy các buổi">
            <strong style={{ color: "var(--fgColor-success)" }}>{formatCurrency(data?.totalTeachingPay ?? 0)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Tổng thực nhận">
            <strong style={{ fontSize: 16, color: "var(--fgColor-accent)" }}>
              {formatCurrency(data?.period?.finalPay ?? data?.totalTeachingPay ?? 0)}
            </strong>
          </Descriptions.Item>
        </Descriptions>
      </div>

      <Divider orientation="left" style={{ margin: "16px 0 12px 0", fontSize: 14 }}>
        Danh sách buổi dạy ({data?.sessions?.length ?? 0} buổi)
      </Divider>
      <Table<PayrollSessionRow>
        dataSource={data?.sessions ?? []}
        columns={sessionColumns}
        rowKey="id"
        loading={loading}
        minWidth={900}
        maxHeight="calc(100vh - 480px)"
        summary={(rows) => {
          const hours = rows.reduce((s, r) => s + (r.hours ?? 0), 0);
          const pay = rows.reduce((s, r) => s + (r.pay ?? 0), 0);
          return (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <strong>Tổng cộng ({rows.length} buổi)</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong>{formatHours(hours)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} align="right">
                  <strong style={{ color: "var(--fgColor-success)" }}>{formatCurrency(pay)}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />

      {adjustments.length > 0 && (
        <>
          <Divider orientation="left" style={{ margin: "20px 0 12px 0", fontSize: 14 }}>
            Khoản điều chỉnh (Thưởng / Phụ cấp / Phạt)
          </Divider>
          <Table<PayrollAdjustmentRow>
            dataSource={adjustments}
            rowKey="id"
            size="small"
            pagination={false}
            columns={adjustmentColumns}
          />
        </>
      )}
    </Modal>
  );
}
