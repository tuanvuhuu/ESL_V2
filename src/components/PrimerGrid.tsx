"use client";

import "@primer/primitives/dist/css/primitives.css";
import "@primer/primitives/dist/css/functional/themes/light.css";
import { Checkbox, Select, Spinner, ThemeProvider } from "@primer/react";
import { DataTable, Table, type Column } from "@primer/react/experimental";
import { useMemo, useState, type ReactNode } from "react";

/** Cột theo kiểu antd (giữ nguyên cấu hình sẵn có ở các trang), chạy trên Primer DataTable. */
export type GridColumn<T> = {
  key?: string | number;
  title?: ReactNode;
  dataIndex?: string;
  width?: number | string;
  align?: "left" | "right" | "center";
  fixed?: "left" | "right" | boolean;
  /** `true`: bấm tiêu đề để sắp xếp; hàm so sánh: sắp xếp tại chỗ. */
  sorter?: boolean | ((a: T, b: T) => number);
  render?: (value: any, row: T, index: number) => ReactNode;
};

export type GridPagination = {
  current?: number;
  pageSize?: number;
  defaultPageSize?: number;
  total?: number;
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  hideOnSinglePage?: boolean;
  showTotal?: (total: number, range: [number, number]) => ReactNode;
  onChange?: (page: number, pageSize: number) => void;
};

export type GridSorter = { columnKey?: string; order?: "ascend" | "descend" };

export type PrimerGridProps<T> = {
  columns: readonly GridColumn<T>[] | readonly any[];
  dataSource?: readonly T[];
  rowKey?: string | ((row: T) => string | number);
  loading?: boolean;
  /** `false`: không phân trang; có `current` + `onChange` thì phân trang theo máy chủ. */
  pagination?: false | GridPagination;
  scroll?: { x?: number | string; y?: number | string };
  locale?: { emptyText?: ReactNode };
  /** Có thì sắp xếp theo máy chủ: bảng báo thứ tự qua đây. */
  onChange?: (pagination: unknown, filters: unknown, sorter: GridSorter) => void;
  /** Thêm cột ô tích chọn nhiều dòng ở đầu bảng. */
  selectable?: boolean;
  onSelectionChange?: (rows: T[]) => void;
};

type Row<T> = T & { id: string | number };

const SIZES = [10, 20, 50, 100];

/**
 * Bảng dữ liệu dùng chung (GitHub Primer React): ô tích chọn, tiêu đề cố định, cuộn trong khung,
 * sắp xếp, phân trang. Nhận cột theo cấu hình antd để chuyển trang không phải viết lại cột.
 */
export function PrimerGrid<T extends object>({
  columns,
  dataSource,
  rowKey = "id",
  loading,
  pagination,
  scroll,
  locale,
  onChange,
  selectable,
  onSelectionChange,
}: PrimerGridProps<T>) {
  const cols = columns as readonly GridColumn<T>[];
  const opts: GridPagination = pagination || {};
  const paged = pagination !== false;
  const serverPaging = paged && opts.current !== undefined && !!opts.onChange;
  const serverSort = !!onChange;

  const [pageSize, setPageSize] = useState(opts.pageSize ?? opts.defaultPageSize ?? 50);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  const keyOf = (r: T): string | number => (typeof rowKey === "function" ? rowKey(r) : ((r as Record<string, unknown>)[rowKey] as string | number));
  const rows = useMemo(() => (dataSource ?? []).map((r) => ({ ...r, id: keyOf(r) }) as Row<T>), [dataSource]); // eslint-disable-line react-hooks/exhaustive-deps

  const size = serverPaging ? (opts.pageSize ?? pageSize) : pageSize;
  const total = serverPaging ? (opts.total ?? 0) : rows.length;
  const page = serverPaging ? (opts.current ?? 1) - 1 : pageIndex;
  // Phân trang tại chỗ thì tự cắt dữ liệu; phân trang theo máy chủ thì dữ liệu đã đúng trang.
  const view = paged && !serverPaging ? rows.slice(page * size, page * size + size) : rows;
  const first = total === 0 ? 0 : page * size + 1;
  const last = Math.min(total, page * size + size);

  const toggle = (id: string | number, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
    onSelectionChange?.(rows.filter((r) => next.has(r.id)));
  };
  const allOn = view.length > 0 && view.every((r) => selected.has(r.id));
  const toggleAll = (on: boolean) => {
    const next = new Set(selected);
    for (const r of view) {
      if (on) next.add(r.id);
      else next.delete(r.id);
    }
    setSelected(next);
    onSelectionChange?.(rows.filter((r) => next.has(r.id)));
  };

  const dtCols: Column<Row<T>>[] = [
    ...(selectable
      ? [
          {
            id: "__select",
            width: 40,
            header: () => <Checkbox aria-label="Chọn tất cả" checked={allOn} onChange={(e) => toggleAll(e.target.checked)} />,
            renderCell: (r: Row<T>) => <Checkbox aria-label="Chọn dòng" checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} />,
          } as Column<Row<T>>,
        ]
      : []),
    ...cols.map((c, i): Column<Row<T>> => {
      const id = String(c.key ?? c.dataIndex ?? i);
      const field = c.dataIndex ?? id;
      return {
        id,
        header: typeof c.title === "string" ? c.title : () => <>{c.title}</>,
        // Cột rộng co giãn để bảng lấp đầy khung; cột hẹp (thao tác, ô tích) giữ cố định.
        ...(typeof c.width === "number" && c.width >= 100 ? { width: "grow" as const, minWidth: c.width } : { width: c.width ?? ("grow" as const) }),
        align: c.align === "right" ? "end" : undefined,
        sortBy: typeof c.sorter === "function" ? (a: Row<T>, b: Row<T>) => (c.sorter as (x: T, y: T) => number)(a, b) : c.sorter ? true : undefined,
        renderCell: (r: Row<T>) => {
          const value = (r as Record<string, unknown>)[field];
          return c.render ? c.render(value, r, 0) : (value as ReactNode);
        },
      };
    }),
  ];

  const sizes = opts.pageSizeOptions ?? (opts.showSizeChanger ? SIZES : undefined);
  const showFooter = paged && !(opts.hideOnSinglePage && total <= size);

  return (
    <ThemeProvider colorMode="day">
      <div className="primer-grid" style={{ position: "relative" }}>
        <div
          className="primer-grid-scroll"
          style={{ maxHeight: scroll?.y !== undefined ? scroll.y : undefined, overflow: "auto", opacity: loading ? 0.5 : 1 }}
        >
          <Table.Container style={{ minWidth: typeof scroll?.x === "number" ? scroll.x : undefined }}>
            <DataTable
              aria-labelledby="primer-grid"
              data={view}
              columns={dtCols}
              cellPadding="condensed"
              externalSorting={serverSort}
              onToggleSort={
                serverSort
                  ? (colId, dir) => onChange?.(undefined, undefined, { columnKey: String(colId), order: dir === "ASC" ? "ascend" : "descend" })
                  : undefined
              }
            />
          </Table.Container>
          {view.length === 0 && !loading && <div className="primer-grid-empty">{locale?.emptyText ?? "Không có dữ liệu"}</div>}
        </div>
        {loading && (
          <div className="primer-grid-loading">
            <Spinner size="medium" />
          </div>
        )}
        {showFooter && (
          <div className="primer-grid-footer">
            <span className="primer-grid-total">{opts.showTotal ? opts.showTotal(total, [first, last]) : `${first}–${last} / ${total}`}</span>
            {sizes && (
              <Select
                aria-label="Số dòng mỗi trang"
                size="small"
                value={String(size)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setPageSize(n);
                  setPageIndex(0);
                  if (serverPaging) opts.onChange?.(1, n);
                }}
              >
                {sizes.map((n) => (
                  <Select.Option key={n} value={String(n)}>{`${n} / trang`}</Select.Option>
                ))}
              </Select>
            )}
            <div className="primer-grid-pager">
              <Table.Pagination
                key={`${size}-${serverPaging ? opts.current : 0}`}
                aria-label="Phân trang"
                totalCount={total}
                pageSize={size}
                defaultPageIndex={page}
                onChange={({ pageIndex: i }) => {
                  setPageIndex(i);
                  if (serverPaging) opts.onChange?.(i + 1, size);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}
