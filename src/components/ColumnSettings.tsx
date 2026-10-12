"use client";

import { SettingOutlined } from "@/client/primer-icons";
import { Button, Checkbox, Popover, Segmented, Space } from "@/client/primer-compat";
import type { ColumnType } from "@/client/primer-compat";
import { useEffect, useMemo, useState } from "react";

type Pin = "left" | "none" | "right";
export type ColumnDef<T> = ColumnType<T> & { key: string; title: string; required?: boolean; defaultPin?: Pin; defaultHidden?: boolean };
type Saved = Record<string, { hidden: boolean; pin: Pin }>;

/** Ẩn/hiện và ghim cột, lưu theo trình duyệt (DESIGN 5A.4). */
export function useColumnSettings<T>(storageKey: string, defs: ColumnDef<T>[]) {
  const defaults = useMemo<Saved>(
    () => Object.fromEntries(defs.map((d) => [d.key, { hidden: !!d.defaultHidden, pin: d.defaultPin ?? "none" }])),
    [defs],
  );
  const [state, setState] = useState<Saved>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cols.${storageKey}`);
      if (raw) setState({ ...defaults, ...(JSON.parse(raw) as Saved) });
    } catch {
      /* bỏ qua */
    }
  }, [storageKey, defaults]);

  const save = (next: Saved) => {
    setState(next);
    try {
      localStorage.setItem(`cols.${storageKey}`, JSON.stringify(next));
    } catch {
      /* bỏ qua */
    }
  };

  const columns = useMemo(() => {
    const visible = defs.filter((d) => d.required || !state[d.key]?.hidden);
    const pinOf = (d: ColumnDef<T>) => state[d.key]?.pin ?? "none";
    const ordered = [
      ...visible.filter((d) => pinOf(d) === "left"),
      ...visible.filter((d) => pinOf(d) === "none"),
      ...visible.filter((d) => pinOf(d) === "right"),
    ];
    return ordered.map(({ required: _r, defaultPin: _p, defaultHidden: _h, ...col }) => {
      const pin = pinOf(col as ColumnDef<T>);
      return {
        ...col,
        title: col.title,
        fixed: pin === "none" ? undefined : pin,
      } as ColumnType<T>;
    });
  }, [defs, state]);

  const leftCount = defs.filter((d) => state[d.key]?.pin === "left").length;
  const rightCount = defs.filter((d) => state[d.key]?.pin === "right").length;

  const panel = (
    <div style={{ width: 340 }}>
      {defs.map((d) => {
        const s = state[d.key] ?? { hidden: false, pin: "none" };
        return (
          <div key={d.key} className="col-row">
            <Checkbox
              checked={d.required || !s.hidden}
              disabled={d.required}
              onChange={(e) => save({ ...state, [d.key]: { ...s, hidden: !e.target.checked } })}
            >
              {d.title}
            </Checkbox>
            <Segmented<Pin>
              size="small"
              disabled={!d.required && s.hidden}
              value={s.pin}
              onChange={(pin) => save({ ...state, [d.key]: { ...s, pin } })}
              options={[
                { value: "left", label: "⇤ Trái" },
                { value: "none", label: "—" },
                { value: "right", label: "Phải ⇥" },
              ]}
            />
          </div>
        );
      })}
      <Space style={{ justifyContent: "space-between", width: "100%", marginTop: 8 }}>
        <span className="sub">
          Ghim trái {leftCount} · ghim phải {rightCount}
        </span>
        <Button size="small" onClick={() => save(defaults)}>
          Khôi phục mặc định
        </Button>
      </Space>
    </div>
  );

  const button = (
    <Popover trigger="click" placement="bottomRight" content={panel} title="Cột">
      <Button icon={<SettingOutlined />}>Cột</Button>
    </Popover>
  );

  return { columns, button };
}
