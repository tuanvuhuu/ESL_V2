"use client";

import { useEffect, useState } from "react";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Card, Col, Divider, Modal, Radio, Row, Select, Space, Table, Tag, message } from "antd";
import { api } from "@/client/api";
import { RateModal } from "@/components/payroll/RateModal";
import { formatCurrency } from "@/lib/finance";
import { OVERLAP_POLICIES, overlapPolicyOption } from "@/lib/payroll";
import { formatDateVN } from "@/lib/dates";

export default function PayrollRatesPage() {
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<any[]>([]);
  const [modalState, setModalState] = useState<{
    open: boolean;
    teacherId: number | null;
    teacherName?: string;
  }>({ open: false, teacherId: null });

  const loadRates = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>("/api/payroll/rates");
      setRates(data);
    } catch (err: any) {
      message.error(err.message || "Không thể tải danh sách đơn giá");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

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
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "TEACHER" ? "blue" : "purple"}>
          {role === "TEACHER" ? "Giáo viên chính" : "Trợ giảng"}
        </Tag>
      ),
    },
    {
      title: "Đơn giá giờ",
      dataIndex: "hourlyRate",
      key: "hourlyRate",
      align: "right" as const,
      render: (rate: number) => (
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#1F6FEB" }}>
          {formatCurrency(rate)} / giờ
        </span>
      ),
    },
    {
      title: "Ngày hiệu lực",
      dataIndex: "effectiveDate",
      key: "effectiveDate",
      render: (d: string) => formatDateVN(d),
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      key: "note",
      render: (note?: string | null) => note || "—",
    },
    {
      title: "Thao tác",
      key: "action",
      align: "center" as const,
      render: (_: any, row: any) => (
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() =>
            setModalState({
              open: true,
              teacherId: row.teacher.id,
              teacherName: row.teacher.fullName,
            })
          }
        >
          Đổi mức giá
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px 0" }}>Cài đặt đơn giá giờ & tính lương</h1>
        <div style={{ color: "#59636E" }}>
          Quản lý lịch sử đơn giá theo giờ riêng cho vai trò giáo viên và trợ giảng, có ngày bắt đầu hiệu lực
        </div>
      </div>

      <Card size="small" title="Lịch sử đơn giá giờ giáo viên" style={{ borderRadius: 8 }}>
        <Table
          dataSource={rates}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      <RateModal
        open={modalState.open}
        teacherId={modalState.teacherId}
        teacherName={modalState.teacherName}
        onClose={() => setModalState({ open: false, teacherId: null })}
        onSuccess={loadRates}
      />
    </div>
  );
}
