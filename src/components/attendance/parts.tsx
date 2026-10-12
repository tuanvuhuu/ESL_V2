"use client";

import { Tag, Tooltip } from "@/client/primer-compat";
import type { ReactNode } from "react";
import { LOW_BALANCE, attendanceOption, type Balance } from "@/lib/attendance";
import { Dash } from "../ui";

/** "còn lại / tổng" + thanh tiến độ; còn ≤ 3 buổi thì màu cảnh báo, hết buổi màu đỏ. */
export function BalanceCell({ balance, warn = true }: { balance: Balance | null | undefined; warn?: boolean }) {
  if (!balance) return <Dash />;
  const total = balance.purchased + balance.adjustment;
  const color = !warn ? "#1F6FEB" : balance.remaining <= 0 ? "#CF222E" : balance.remaining <= LOW_BALANCE ? "#D29922" : "#2DA44E";
  const pct = total > 0 ? Math.max(0, Math.min(100, (balance.remaining / total) * 100)) : 0;
  return (
    <Tooltip
      title={`Đã mua ${balance.purchased}${balance.adjustment ? `, điều chỉnh ${balance.adjustment > 0 ? "+" : ""}${balance.adjustment}` : ""}, đã trừ ${balance.used}`}
    >
      <span className="balance">
        <span>
          <b style={{ color }}>{balance.remaining}</b>
          <span className="sub"> / {total}</span>
        </span>
        <span className="balance-bar">
          <span style={{ width: `${pct}%`, background: color }} />
        </span>
      </span>
    </Tooltip>
  );
}

export function AttendanceTag({ status }: { status: string | null | undefined }) {
  const o = status ? attendanceOption(status) : null;
  if (!o) return <Tag>Chưa điểm danh</Tag>;
  return <Tag style={{ color: o.color, borderColor: o.color, background: `${o.color}12` }}>{o.label}</Tag>;
}

export function MakeupTag({ children = "Học bù" }: { children?: ReactNode }) {
  return <Tag color="purple">{children}</Tag>;
}
