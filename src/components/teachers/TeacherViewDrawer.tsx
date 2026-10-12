"use client";

import { Button as PrimerButton } from "@primer/react";
import {
  CopyIcon,
  DeviceMobileIcon,
  LinkExternalIcon,
  MailIcon,
  PencilIcon,
} from "@primer/octicons-react";
import Link from "next/link";
import { PrimerDrawer } from "@/components/PrimerModal";
import type { Teacher } from "@/client/types";
import { CertTag, Dash, StatusTag } from "@/components/ui";
import { EMPLOYMENTS, TEACHER_ORIGINS, TEACHER_ROLES, TEACHER_STATUSES, optionOf } from "@/lib/constants";
import { formatPhone } from "@/lib/text";
import { message } from "@/client/toast";

type TeacherRow = Teacher & { activeClassCount: number; monthHours: number };

type Props = {
  open: boolean;
  teacher: TeacherRow | null;
  canEdit?: boolean;
  onClose: () => void;
  onEdit?: (t: TeacherRow) => void;
};

export function TeacherViewDrawer({
  open,
  teacher,
  canEdit,
  onClose,
  onEdit,
}: Props) {
  if (!teacher) return null;

  const copy = (val?: string | null, label = "thông tin") => {
    if (!val) return;
    void navigator.clipboard?.writeText(val);
    message.success(`Đã sao chép ${label}`);
  };

  return (
    <PrimerDrawer
      open={open}
      width="min(640px, 92vw)"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{teacher.displayName}</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 6,
              background: "#EAEFF2",
              color: "#313D44",
            }}
          >
            {teacher.code}
          </span>
        </div>
      }
      subtitle={`Họ và tên đầy đủ: ${teacher.fullName}`}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <Link
            href={`/teachers/${teacher.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-accent-fg, #0969da)",
              textDecoration: "none",
            }}
          >
            Mở trang đầy đủ <LinkExternalIcon size={14} />
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <PrimerButton size="medium" onClick={onClose}>
              Đóng
            </PrimerButton>
            {canEdit && onEdit && (
              <PrimerButton
                variant="primary"
                size="medium"
                leadingVisual={PencilIcon}
                onClick={() => {
                  onClose();
                  onEdit(teacher);
                }}
              >
                Sửa thông tin
              </PrimerButton>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Status header banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "#F6F8FA",
            borderRadius: 8,
            border: "1px solid #D8DEE4",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusTag options={TEACHER_STATUSES} value={teacher.status} />
            <CertTag expiry={teacher.certExpiry} always />
          </div>
          <span style={{ fontSize: 12, color: "#59636E" }}>
            {optionOf(EMPLOYMENTS, teacher.employment)?.label} · {optionOf(TEACHER_ORIGINS, teacher.origin)?.label}
          </span>
        </div>

        {/* Section 1: Thông tin công tác */}
        <div
          style={{
            border: "1px solid #D8DEE4",
            borderRadius: 8,
            padding: "14px 16px",
            background: "#FFFFFF",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: 13,
              fontWeight: 600,
              color: "#59636E",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Thông tin công tác & Giảng dạy
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              rowGap: 12,
              columnGap: 16,
              fontSize: 13,
            }}
          >
            <div>
              <span style={{ color: "#656D76" }}>Vai trò:</span>{" "}
              <b>{optionOf(TEACHER_ROLES, teacher.role)?.label ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Hình thức:</span>{" "}
              <b>{optionOf(EMPLOYMENTS, teacher.employment)?.label ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Nguồn gốc:</span>{" "}
              <b>{optionOf(TEACHER_ORIGINS, teacher.origin)?.label ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Lớp đang phụ trách:</span>{" "}
              <b className="num" style={{ color: "var(--color-accent-fg, #0969da)" }}>
                {teacher.activeClassCount} lớp
              </b>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Giờ dạy trong tháng:</span>{" "}
              <b className="num">
                {teacher.monthHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ
              </b>
            </div>
          </div>
        </div>

        {/* Section 2: Thông tin liên hệ */}
        <div
          style={{
            border: "1px solid #D8DEE4",
            borderRadius: 8,
            padding: "14px 16px",
            background: "#FFFFFF",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: 13,
              fontWeight: 600,
              color: "#59636E",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Thông tin liên hệ
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "#F6F8FA",
                borderRadius: 6,
                border: "1px solid #EAEFF2",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <DeviceMobileIcon size={14} fill="#59636E" />
                <span style={{ color: "#656D76" }}>Số điện thoại:</span>{" "}
                {teacher.phone ? (
                  <a
                    href={`tel:${teacher.phone}`}
                    style={{
                      color: "var(--color-accent-fg, #0969da)",
                      textDecoration: "none",
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 600,
                    }}
                  >
                    {formatPhone(teacher.phone)}
                  </a>
                ) : (
                  <Dash />
                )}
              </div>
              {teacher.phone && (
                <PrimerButton
                  size="small"
                  leadingVisual={CopyIcon}
                  onClick={() => copy(teacher.phone, "số điện thoại")}
                >
                  Sao chép
                </PrimerButton>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "#F6F8FA",
                borderRadius: 6,
                border: "1px solid #EAEFF2",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <MailIcon size={14} fill="#59636E" />
                <span style={{ color: "#656D76" }}>Email:</span>{" "}
                {teacher.email ? (
                  <a
                    href={`mailto:${teacher.email}`}
                    style={{
                      color: "var(--color-accent-fg, #0969da)",
                      textDecoration: "none",
                    }}
                  >
                    {teacher.email}
                  </a>
                ) : (
                  <Dash />
                )}
              </div>
              {teacher.email && (
                <PrimerButton
                  size="small"
                  leadingVisual={CopyIcon}
                  onClick={() => copy(teacher.email, "email")}
                >
                  Sao chép
                </PrimerButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </PrimerDrawer>
  );
}
