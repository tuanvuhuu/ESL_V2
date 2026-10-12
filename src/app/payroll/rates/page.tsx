"use client";

import { useEffect, useState } from "react";
import { PlusIcon } from "@primer/octicons-react";
import { Button as PrimerButton } from "@primer/react";
import { message } from "@/client/primer-compat";
import { api } from "@/client/api";
import { RateModal } from "@/components/payroll/RateModal";
import { PrimerGrid } from "@/components/PrimerGrid";
import { DotLabel, PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/finance";
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
        <DotLabel color={role === "TEACHER" ? "#0969DA" : "#8250DF"}>
          {role === "TEACHER" ? "Giáo viên chính" : "Trợ giảng"}
        </DotLabel>
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
        <PrimerButton
          size="small"
          leadingVisual={PlusIcon}
          onClick={() =>
            setModalState({
              open: true,
              teacherId: row.teacher.id,
              teacherName: row.teacher.fullName,
            })
          }
        >
          Đổi mức giá
        </PrimerButton>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <PageHeader
        title="Cài đặt đơn giá giờ & tính lương"
        description="Quản lý lịch sử đơn giá theo giờ riêng cho vai trò giáo viên và trợ giảng, có ngày bắt đầu hiệu lực"
      />

      <PrimerGrid
        dataSource={rates}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true }}
      />

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
