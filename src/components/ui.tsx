"use client";

import { ActionMenu as PrimerActionMenu, ActionList, IconButton } from "@primer/react";
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
import type { ReactNode } from "react";
import { CERT_WARN_DAYS, optionOf, type Option } from "@/lib/constants";
import { addDays, formatDateVN, todayISO } from "@/lib/dates";
import { initials } from "@/lib/text";

export function StatusTag({ options, value, sub }: { options: readonly Option[]; value: string; sub?: string | null }) {
  const opt = optionOf(options, value);
  if (!opt) return <Dash />;
  return (
    <div>
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 500,
          color: opt.color,
          border: `1px solid ${opt.color}`,
          background: `${opt.color}12`,
        }}
      >
        {opt.label}
      </span>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function CenterTag({ center }: { center?: { name: string; color: string } | null }) {
  if (!center) return <Dash />;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        color: center.color,
        border: `1px solid ${center.color}`,
        background: `${center.color}12`,
      }}
    >
      {center.name}
    </span>
  );
}

/** Hạn chứng chỉ giáo viên (M8): đỏ khi đã hết hạn, vàng khi còn ≤ 60 ngày; `always` thì hiện cả khi còn hạn. */
export function CertTag({ expiry, always }: { expiry: string | null | undefined; always?: boolean }) {
  if (!expiry) return always ? <Dash /> : null;
  const today = todayISO();
  if (expiry < today) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 500,
          color: "#CF222E",
          background: "#FFEBE9",
          border: "1px solid #FF8182",
        }}
      >
        Hết hạn {formatDateVN(expiry)}
      </span>
    );
  }
  if (expiry <= addDays(today, CERT_WARN_DAYS)) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 500,
          color: "#9A6700",
          background: "#FFF8C5",
          border: "1px solid #D4A72C",
        }}
      >
        Hết hạn {formatDateVN(expiry)}
      </span>
    );
  }
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
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${c}2e`,
        color: c,
        fontWeight: 600,
        fontSize: size >= 32 ? 13 : 11,
        display: "inline-grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </span>
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
      <div className="page-header-title-group">
        <h2 className="page-header-title">
          {title}
        </h2>
        {description ? <span className="page-desc">{description}</span> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
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
export function ActionMenu({ title, items }: { title: string; items?: (ActionMenuItem | null | undefined | false)[] | any[] }) {
  const list = (items ?? []).filter(Boolean) as (ActionMenuItem & Record<string, any>)[];

  return (
    <PrimerActionMenu>
      <PrimerActionMenu.Anchor>
        <IconButton
          icon={KebabHorizontalIcon}
          variant="invisible"
          size="small"
          aria-label="Thao tác"
          className="action-menu-btn"
        />
      </PrimerActionMenu.Anchor>
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
