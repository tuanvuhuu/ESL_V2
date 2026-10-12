"use client";

import { useEffect, useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Button, Descriptions, Divider, Modal, Popconfirm, Table, Tag, message } from "antd";
import { api } from "@/client/api";
import { formatCurrency } from "@/lib/finance";
import { adjustmentTypeOption, formatHours } from "@/lib/payroll";
import { formatDateVN } from "@/lib/dates";

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
  const [data, setData] = useState<any>(null);

  const loadDetails = async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const res = await api.get<any>(`/api/my/payroll?month=${month}&teacherId=${teacherId}`);
      setData(res);
    } catch (err: any) {
      message.error(err.message || "Không thể tải chi tiết giờ dạy");
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
    } catch (err: any) {
      message.error(err.message || "Không thể xóa điều chỉnh");
    }
  };

  const sessionColumns = [
    {
      title: "Ngày",
      dataIndex: "date",
      key: "date",
      render: (d: string) => formatDateVN(d),
    },
    {
      title: "Thời gian",
      key: "time",
      render: (_: any, r: any) => `${r.startTime}–${r.endTime}`,
    },
    {
      title: "Lớp & Phòng",
      key: "class",
      render: (_: any, r: any) => (
        <span>
          <strong>{r.className}</strong>{" "}
          <span style={{ fontSize: 12, color: "#8C959F" }}>
            {r.classCode} · {r.roomName} ({r.centerName})
          </span>
        </span>
      ),
    },
    {
      title: "Vai trò",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "TEACHER" ? "blue" : "purple"}>
          {role === "TEACHER" ? "Giáo viên" : "Trợ giảng"}
        </Tag>
      ),
    },
    {
      title: "Số giờ",
      dataIndex: "hours",
      key: "hours",
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
      key: "hourlyRate",
      align: "right" as const,
      render: (rate: number) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(rate)}/h</span>
      ),
    },
    {
      title: "Thành tiền",
      dataIndex: "pay",
      key: "pay",
      align: "right" as const,
      render: (pay: number) => (
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#2DA44E" }}>
          {formatCurrency(pay)}
        </span>
      ),
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
            <strong style={{ color: "#2DA44E" }}>{formatCurrency(data?.totalTeachingPay ?? 0)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Tổng thực nhận">
            <strong style={{ fontSize: 16, color: "#1F6FEB" }}>
              {formatCurrency(data?.period?.finalPay ?? data?.totalTeachingPay ?? 0)}
            </strong>
          </Descriptions.Item>
        </Descriptions>
      </div>

      <Divider orientation="left" style={{ margin: "16px 0 12px 0", fontSize: 14 }}>
        Danh sách buổi dạy ({data?.sessions?.length ?? 0} buổi)
      </Divider>
      <Table
        dataSource={data?.sessions ?? []}
        columns={sessionColumns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        bordered
        sticky
        scroll={{ x: 900, y: "calc(100vh - 480px)" }}
        summary={(rows) => {
          const hours = rows.reduce((s: number, r: any) => s + (r.hours ?? 0), 0);
          const pay = rows.reduce((s: number, r: any) => s + (r.pay ?? 0), 0);
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
                  <strong style={{ color: "#2DA44E" }}>{formatCurrency(pay)}</strong>
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
          <Table
            dataSource={adjustments}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: "Loại",
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
                      color: r.type === "PENALTY" ? "#CF222E" : "#2DA44E",
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
                align: "center" as const,
                render: (_: any, r: any) =>
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
            ]}
          />
        </>
      )}
    </Modal>
  );
}
