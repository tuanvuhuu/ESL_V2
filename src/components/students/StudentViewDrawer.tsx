"use client";

import { Button as PrimerButton } from "@primer/react";
import {
  CopyIcon,
  DeviceMobileIcon,
  LinkExternalIcon,
  PencilIcon,
  PersonIcon,
} from "@primer/octicons-react";
import Link from "next/link";
import { PrimerDrawer } from "@/components/PrimerModal";
import type { StudentRow } from "@/client/types";
import { Dash, DotLabel, StatusTag } from "@/components/ui";
import { GENDERS, STUDENT_STATUSES, optionOf } from "@/lib/constants";
import { ageFrom, formatDateVN, todayISO } from "@/lib/dates";
import { formatPhone } from "@/lib/text";
import { message } from "@/client/toast";

type Props = {
  open: boolean;
  student: StudentRow | null;
  canEdit?: boolean;
  onClose: () => void;
  onEdit?: (s: StudentRow) => void;
  onStatus?: (s: StudentRow) => void;
};

export function StudentViewDrawer({
  open,
  student,
  canEdit,
  onClose,
  onEdit,
  onStatus,
}: Props) {
  if (!student) return null;

  const today = todayISO();
  const primaryG = student.guardians.find((g) => g.isPrimary) ?? student.guardians[0];

  const copyPhone = (phone?: string | null) => {
    if (!phone) return;
    void navigator.clipboard?.writeText(phone);
    message.success(`Đã sao chép ${formatPhone(phone)}`);
  };

  return (
    <PrimerDrawer
      open={open}
      width="min(640px, 92vw)"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{student.fullName}</span>
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
            {student.code}
          </span>
        </div>
      }
      subtitle={
        student.englishName
          ? `Tên tiếng Anh: ${student.englishName}`
          : "Hồ sơ chi tiết học viên"
      }
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <Link
            href={`/students/${student.id}`}
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
                  onEdit(student);
                }}
              >
                Sửa hồ sơ
              </PrimerButton>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header overview banner */}
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
            <DotLabel color={student.center.color}>{student.center.name}</DotLabel>
            <StatusTag options={STUDENT_STATUSES} value={student.status} sub={student.statusReason} />
          </div>
          {canEdit && onStatus && (
            <PrimerButton
              size="small"
              onClick={() => {
                onClose();
                onStatus(student);
              }}
            >
              Đổi trạng thái
            </PrimerButton>
          )}
        </div>

        {/* Section 1: Thông tin cá nhân */}
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
            Thông tin cá nhân
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
              <span style={{ color: "#656D76" }}>Ngày sinh:</span>{" "}
              <b>{formatDateVN(student.dob)}</b>{" "}
              <span style={{ color: "#656D76", fontSize: 12 }}>
                ({ageFrom(student.dob, today)} tuổi)
              </span>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Giới tính:</span>{" "}
              <b>{optionOf(GENDERS, student.gender)?.label ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Trường học:</span>{" "}
              <b>{student.school ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Khối lớp trường:</span>{" "}
              <b>{student.schoolGrade ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Trình độ:</span>{" "}
              <b>{student.level ?? <Dash />}</b>
            </div>
            <div>
              <span style={{ color: "#656D76" }}>Ngày tạo hồ sơ:</span>{" "}
              <span>{formatDateVN(student.createdAt)}</span>
            </div>
          </div>
          {student.note && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "#F6F8FA",
                borderRadius: 6,
                fontSize: 12,
                color: "#59636E",
              }}
            >
              <b>Ghi chú:</b> {student.note}
            </div>
          )}
        </div>

        {/* Section 2: Lớp học */}
        <div
          style={{
            border: "1px solid #D8DEE4",
            borderRadius: 8,
            padding: "14px 16px",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "#59636E",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Lớp đang theo học ({student.enrollments.length})
            </h3>
          </div>
          {student.enrollments.length === 0 ? (
            <div style={{ color: "#656D76", fontSize: 13, fontStyle: "italic" }}>
              Chưa ghi danh vào lớp nào
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {student.enrollments.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#F6F8FA",
                    borderRadius: 6,
                    border: "1px solid #EAEFF2",
                  }}
                >
                  <div>
                    <Link
                      href={`/classes/${e.class.id}`}
                      style={{
                        fontWeight: 600,
                        color: "var(--color-accent-fg, #0969da)",
                        textDecoration: "none",
                      }}
                    >
                      {e.class.code}
                    </Link>{" "}
                    <span style={{ color: "#59636E", fontSize: 13 }}>— {e.class.name}</span>
                  </div>
                  <Link
                    href={`/classes/${e.class.id}`}
                    style={{ fontSize: 12, color: "#656D76", textDecoration: "none" }}
                  >
                    Xem lớp ↗
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Phụ huynh & Liên hệ */}
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
            Thông tin phụ huynh & Liên hệ
          </h3>
          {student.guardians.length === 0 ? (
            <div style={{ color: "#656D76", fontSize: 13, fontStyle: "italic" }}>
              Chưa có thông tin phụ huynh
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {student.guardians.map((g, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: g.isPrimary ? "#F0F7FF" : "#F6F8FA",
                    borderRadius: 6,
                    border: g.isPrimary ? "1px solid #B6D7FD" : "1px solid #EAEFF2",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PersonIcon size={14} fill="#59636E" />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {g.parent.fullName}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: g.isPrimary ? "#0969DA" : "#EAEFF2",
                          color: g.isPrimary ? "#FFFFFF" : "#59636E",
                          fontWeight: 500,
                        }}
                      >
                        {g.relation || (g.isPrimary ? "Chính" : "Phụ")}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 4,
                        fontSize: 12,
                        color: "#59636E",
                      }}
                    >
                      <DeviceMobileIcon size={13} />
                      <a
                        href={`tel:${g.parent.phone}`}
                        style={{
                          color: "var(--color-accent-fg, #0969da)",
                          textDecoration: "none",
                          fontFamily: "var(--font-mono, monospace)",
                          fontWeight: 500,
                        }}
                      >
                        {formatPhone(g.parent.phone)}
                      </a>
                      {g.parent.zalo && <span>· Zalo: {g.parent.zalo}</span>}
                    </div>
                  </div>
                  <PrimerButton
                    size="small"
                    leadingVisual={CopyIcon}
                    onClick={() => copyPhone(g.parent.phone)}
                  >
                    Sao chép SĐT
                  </PrimerButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PrimerDrawer>
  );
}
