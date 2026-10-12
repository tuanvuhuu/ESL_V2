"use client";

import { ActionMenu as PrimerActionMenu, ActionList } from "@primer/react";
import {
  ClockIcon,
  CopyIcon,
  DeviceMobileIcon,
  EyeIcon,
  KebabHorizontalIcon,
  PencilIcon,
  PlayIcon,
  SyncIcon,
  TrashIcon,
} from "@primer/octicons-react";
import { Avatar, Tag, Typography, type MenuProps } from "antd";
import type { ReactNode } from "react";
import { CERT_WARN_DAYS, optionOf, type Option } from "@/lib/constants";
import { addDays, formatDateVN, todayISO } from "@/lib/dates";
import { initials } from "@/lib/text";

export function StatusTag({ options, value, sub }: { options: readonly Option[]; value: string; sub?: string | null }) {
  const opt = optionOf(options, value);
  if (!opt) return <Dash />;
  return (
    <div>
      <Tag color={undefined} style={{ color: opt.color, borderColor: opt.color, background: `${opt.color}12`, marginInlineEnd: 0 }}>
        {opt.label}
      </Tag>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function CenterTag({ center }: { center?: { name: string; color: string } | null }) {
  if (!center) return <Dash />;
  return (
    <Tag style={{ color: center.color, borderColor: center.color, background: `${center.color}12` }}>{center.name}</Tag>
  );
}

/** Hạn chứng chỉ giáo viên (M8): đỏ khi đã hết hạn, vàng khi còn ≤ 60 ngày; `always` thì hiện cả khi còn hạn. */
export function CertTag({ expiry, always }: { expiry: string | null | undefined; always?: boolean }) {
  if (!expiry) return always ? <Dash /> : null;
  const today = todayISO();
  if (expiry < today) return <Tag color="red">Hết hạn {formatDateVN(expiry)}</Tag>;
  if (expiry <= addDays(today, CERT_WARN_DAYS)) return <Tag color="orange">Hết hạn {formatDateVN(expiry)}</Tag>;
  return always ? <span className="sub">Đến {formatDateVN(expiry)}</span> : null;
}

export function Dash() {
  return <span className="muted">—</span>;
}

/** Chấm màu + chữ, gọn hơn thẻ viền (dùng trong bảng). */
export function DotLabel({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span className="dot-label">
      <i style={{ background: color ?? "#8C959F" }} />
      {children}
    </span>
  );
}

export function PersonAvatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  const c = color ?? "#8C959F";
  return (
    <Avatar size={size} style={{ background: `${c}2e`, color: c, fontWeight: 600, flexShrink: 0 }}>
      {initials(name)}
    </Avatar>
  );
}

export function TwoLine({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div>{main}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <Typography.Title level={4} style={{ margin: 0, fontSize: 16 }}>
          {title}
        </Typography.Title>
        {description ? <div className="page-desc">{description}</div> : null}
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}

export type ActionMenuItem = {
  key?: string | number;
  label?: ReactNode;
  icon?: React.ComponentType<any>;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  type?: "divider" | "group";
};

/**
 * Nút ⋯ cuối dòng chuẩn Primer React: ActionMenu + ActionList (theo Storybook).
 * Tự động gắn icon phù hợp theo key, có divider và variant="danger" cho tác vụ huỷ/xoá.
 */
export function ActionMenu({ title, items }: { title: string; items?: (ActionMenuItem | null | undefined | false)[] | MenuProps["items"] }) {
  const list = (items ?? []).filter(Boolean) as (ActionMenuItem & Record<string, any>)[];

  return (
    <PrimerActionMenu>
      <PrimerActionMenu.Button
        aria-label="Thao tác"
        size="small"
        variant="invisible"
        leadingVisual={KebabHorizontalIcon}
        className="action-menu-btn"
      />
      <PrimerActionMenu.Overlay align="end" width="medium">
        <ActionList showDividers={false}>
          {title && (
            <>
              <ActionList.Item disabled className="action-menu-title">
                <span style={{ fontWeight: 600, color: "#59636e", fontSize: 12 }}>{title}</span>
              </ActionList.Item>
              <ActionList.Divider />
            </>
          )}
          {list.map((it, idx) => {
            if (it.type === "divider") {
              return <ActionList.Divider key={`div-${idx}`} />;
            }
            const Icon = it.icon ?? iconForAction(it.key);
            return (
              <ActionList.Item
                key={it.key ?? idx}
                variant={it.danger ? "danger" : "default"}
                disabled={it.disabled}
                onSelect={() => it.onClick?.()}
              >
                {Icon && (
                  <ActionList.LeadingVisual>
                    <Icon />
                  </ActionList.LeadingVisual>
                )}
                {it.label}
              </ActionList.Item>
            );
          })}
        </ActionList>
      </PrimerActionMenu.Overlay>
    </PrimerActionMenu>
  );
}

function iconForAction(key?: string | number): React.ComponentType<any> | undefined {
  switch (key) {
    case "view":
      return EyeIcon;
    case "edit":
      return PencilIcon;
    case "status":
      return SyncIcon;
    case "call":
      return DeviceMobileIcon;
    case "copy":
      return CopyIcon;
    case "reserve":
      return ClockIcon;
    case "back":
      return PlayIcon;
    case "quit":
    case "delete":
      return TrashIcon;
    default:
      return undefined;
  }
}
