"use client";

import { Table, type TableProps } from "antd";

export type DataGridProps<T> = TableProps<T> & {
  /** Chiều cao khung cuộn dọc (scroll.y). */
  maxHeight?: string;
  /** Bề rộng tối thiểu, hẹp hơn thì bảng cuộn ngang (scroll.x). */
  minWidth?: number;
};

/**
 * Bảng dài dùng chung: bảng gọn, viền, tiêu đề cố định, cuộn dọc trong khung.
 * Truyền `scroll` sẽ ghi đè `maxHeight` / `minWidth` tương ứng.
 */
export function DataGrid<T>({ maxHeight = "calc(100vh - 320px)", minWidth = 900, scroll, ...rest }: DataGridProps<T>) {
  const merged = { ...scroll };
  if (merged.x === undefined) merged.x = minWidth;
  if (merged.y === undefined) merged.y = maxHeight;

  return <Table<T> size="small" bordered sticky pagination={false} {...rest} scroll={merged} />;
}