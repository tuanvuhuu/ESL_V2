"use client";

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
import { Button, message } from "@/client/primer-compat";

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
              background: "var(--bgColor-neutral-muted)",
              color: "var(--fgColor-default)",
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
              color: "var(--fgColor-accent)",
              textDecoration: "none",
            }}
          >
            Mở trang đầy đủ <LinkExternalIcon size={14} />
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={onClose}>
              Đóng
            </Button>
            {canEdit && onEdit && (
              <Button
                type="primary"
                icon={<PencilIcon />}
                onClick={() => {
                  onClose();
                  onEdit(teacher);
                }}
              >
                Sửa thông tin
              </Button>
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
            background: "var(--bgColor-muted)",
            borderRadius: 8,
            border: "1px solid var(--borderColor-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusTag options={TEACHER_STATUSES} value={teacher.status} />
            <CertTag expiry={teacher.certExpiry} always />
          </div>
          <span style={{ fontSize: 12, color: "var(--fgColor-muted)" }}>
            {optionOf(EMPLOYMENTS, teacher.employment)?.label} · {optionOf(TEACHER_ORIGINS, teacher.origin)?.label}
          </span>
        </div>

        {/* Section 1: Thông tin công tác */}
        <div
          style={{
            border: "1px solid var(--borderColor-muted)",
            borderRadius: 8,
            padding: "14px 16px",
            background: "var(--bgColor-default)",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--fgColor-muted)",
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
              <span style={{ color: "var(--fgColor-muted)" }}>Vai trò:</span>{" "}
              <b>{optionOf(TEACHER_ROLES, teacher.role)?.label ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "var(--fgColor-muted)" }}>Hình thức:</span>{" "}
              <b>{optionOf(EMPLOYMENTS, teacher.employment)?.label ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "var(--fgColor-muted)" }}>Nguồn gốc:</span>{" "}
              <b>{optionOf(TEACHER_ORIGINS, teacher.origin)?.label ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "var(--fgColor-muted)" }}>Lớp đang phụ trách:</span>{" "}
              <b className="num" style={{ color: "var(--fgColor-accent)" }}>
                {teacher.activeClassCount} lớp
              </b>
            </div>
            <div>
              <span style={{ color: "var(--fgColor-muted)" }}>Giờ dạy trong tháng:</span>{" "}
              <b className="num">
                {teacher.monthHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ
              </b>
            </div>
          </div>
        </div>

        {/* Section 2: Thông tin liên hệ */}
        <div
          style={{
            border: "1px solid var(--borderColor-muted)",
            borderRadius: 8,
            padding: "14px 16px",
            background: "var(--bgColor-default)",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--fgColor-muted)",
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
                background: "var(--bgColor-muted)",
                borderRadius: 6,
                border: "1px solid var(--borderColor-muted)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ display: "inline-flex", color: "var(--fgColor-muted)" }}><DeviceMobileIcon size={14} /></span>
                <span style={{ color: "var(--fgColor-muted)" }}>Số điện thoại:</span>{" "}
                {teacher.phone ? (
                  <a
                    href={`tel:${teacher.phone}`}
                    style={{
                      color: "var(--fgColor-accent)",
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
                <Button
                  size="small"
                  icon={<CopyIcon />}
                  onClick={() => copy(teacher.phone, "số điện thoại")}
                >
                  Sao chép
                </Button>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "var(--bgColor-muted)",
                borderRadius: 6,
                border: "1px solid var(--borderColor-muted)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ display: "inline-flex", color: "var(--fgColor-muted)" }}><MailIcon size={14} /></span>
                <span style={{ color: "var(--fgColor-muted)" }}>Email:</span>{" "}
                {teacher.email ? (
                  <a
                    href={`mailto:${teacher.email}`}
                    style={{
                      color: "var(--fgColor-accent)",
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
                <Button
                  size="small"
                  icon={<CopyIcon />}
                  onClick={() => copy(teacher.email, "email")}
                >
                  Sao chép
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </PrimerDrawer>
  );
}
