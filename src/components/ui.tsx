"use client";

import { MoreOutlined } from "@ant-design/icons";
import { Avatar, Button, Dropdown, Tag, Typography, type MenuProps } from "antd";
import type { ReactNode } from "react";
import { optionOf, type Option } from "@/lib/constants";
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

export function Dash() {
  return <span className="muted">—</span>;
}

export function PersonAvatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <Avatar size={size} style={{ background: color ?? "#8C959F", flexShrink: 0 }}>
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
        <Typography.Title level={4} style={{ margin: 0, fontSize: 20 }}>
          {title}
        </Typography.Title>
        {description ? <div className="page-desc">{description}</div> : null}
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}

/** Nút ⋯ cuối dòng: đầu menu ghi tên + mã để tránh thao tác nhầm (DESIGN 5A.5). */
export function ActionMenu({ title, items }: { title: string; items: MenuProps["items"] }) {
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{
        items: [{ key: "__title", label: <b>{title}</b>, disabled: true }, { type: "divider" }, ...(items ?? [])],
      }}
    >
      <Button type="text" icon={<MoreOutlined rotate={90} />} aria-label="Thao tác" />
    </Dropdown>
  );
}
