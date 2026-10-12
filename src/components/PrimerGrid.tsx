"use client";

import "@primer/primitives/dist/css/primitives.css";
import "@primer/primitives/dist/css/functional/themes/light.css";
import { Checkbox, Pagination, Select, Spinner, ThemeProvider, UnderlineNav } from "@primer/react";
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

export type PrimerGridProps<T extends object = any> = {
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
  /** Thanh gắn liền phía trên tiêu đề bảng (vd. tab lọc trạng thái). */
  toolbar?: ReactNode;
  /** Thanh hành động / bộ lọc gắn liền phía trên tiêu đề bảng (sát tiêu đề) */
  actionsComponent?: ReactNode;
  /** Bí danh cho actionsComponent */
  actions?: ReactNode;
  summary?: (rows: readonly T[]) => ReactNode;
  minWidth?: number;
  maxHeight?: string;
  size?: "small" | "middle" | "large";
};

/** Tab lọc kiểu GitHub (UnderlineNav + CounterLabel của Primer), đặt vào `toolbar` của PrimerGrid. */
export function FilterTabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: ReactNode; count?: number; color?: string }[];
}) {
  return (
    <UnderlineNav aria-label="Bộ lọc">
      {items.map((it) => (
        <UnderlineNav.Item
          key={it.value}
          as="button"
          aria-current={it.value === value ? "page" : undefined}
          onSelect={() => onChange(it.value)}
          counter={it.count}
        >
          {it.color && <i className="pg-dot" style={{ background: it.color }} />}
          {it.label}
        </UnderlineNav.Item>
      ))}
    </UnderlineNav>
  );
}

type Row<T> = T & { id: string | number };

const SIZES = [10, 20, 50, 100];
/** Cột khai báo rộng từ mức này trở lên thì co giãn lấp khung; hẹp hơn giữ đúng bề rộng. */
const GROW_FROM = 200;

function Pager({ current, count, onGo }: { current: number; count: number; onGo: (p: number) => void }) {
  return (
    <Pagination
      pageCount={count}
      currentPage={current}
      onPageChange={(e, p) => {
        e.preventDefault();
        onGo(p);
      }}
      marginPageCount={1}
      surroundingPageCount={1}
      showPages={{ narrow: false }}
    />
  );
}

/**
 * Bảng dữ liệu dùng chung (GitHub Primer React DataTable): ô tích chọn, tiêu đề cố định, cuộn trong khung,
 * sắp xếp, phân trang tiếng Việt. Nhận cột theo cấu hình antd để chuyển trang không phải viết lại cột.
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
  toolbar,
  actionsComponent,
  actions,
  summary,
  minWidth,
  maxHeight,
  size: sizeProp,
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
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(serverPaging ? (opts.current ?? 1) - 1 : pageIndex, pageCount - 1);
  // Phân trang tại chỗ thì tự cắt dữ liệu; phân trang theo máy chủ thì dữ liệu đã đúng trang.
  const view = paged && !serverPaging ? rows.slice(page * size, page * size + size) : rows;
  const first = total === 0 ? 0 : page * size + 1;
  const last = Math.min(total, page * size + size);

  const emit = (next: Set<string | number>) => {
    setSelected(next);
    onSelectionChange?.(rows.filter((r) => next.has(r.id)));
  };
  const allOn = view.length > 0 && view.every((r) => selected.has(r.id));
  const someOn = !allOn && view.some((r) => selected.has(r.id));

  const dtCols: Column<Row<T>>[] = [
    ...(selectable
      ? [
          {
            id: "__select",
            width: 44,
            header: () => (
              <Checkbox
                aria-label="Chọn tất cả"
                checked={allOn}
                indeterminate={someOn}
                onChange={(e) => {
                  const next = new Set(selected);
                  for (const r of view) e.target.checked ? next.add(r.id) : next.delete(r.id);
                  emit(next);
                }}
              />
            ),
            renderCell: (r: Row<T>) => (
              <Checkbox
                aria-label="Chọn dòng"
                checked={selected.has(r.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(r.id);
                  else next.delete(r.id);
                  emit(next);
                }}
              />
            ),
          } as Column<Row<T>>,
        ]
      : []),
    ...cols.map((c, i): Column<Row<T>> => {
      const id = String(c.key ?? c.dataIndex ?? i);
      const field = c.dataIndex ?? id;
      const w = c.width;
      return {
        id,
        header: typeof c.title === "string" ? c.title : () => <>{c.title}</>,
        ...(typeof w === "number" ? (w >= GROW_FROM ? { width: "grow" as const, minWidth: w } : { width: w }) : { width: w ?? ("grow" as const) }),
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

  const go = (p: number) => {
    setPageIndex(p - 1);
    if (serverPaging) opts.onChange?.(p, size);
  };

  const topActions = actionsComponent ?? actions;
  const hasTopBar = Boolean(toolbar || topActions);

  return (
    <ThemeProvider colorMode="light">
      <div className={`primer-grid${loading ? " is-loading" : ""}`}>
        {hasTopBar && (
          <div className="primer-grid-toolbar">
            {toolbar && <div className="primer-grid-toolbar-left">{toolbar}</div>}
            {topActions && <div className="primer-grid-toolbar-actions">{topActions}</div>}
          </div>
        )}
        <div className="primer-grid-scroll" style={{ maxHeight: maxHeight ?? scroll?.y }}>
          <Table.Container style={{ minWidth: minWidth ?? (typeof scroll?.x === "number" ? scroll.x : undefined) }}>
            <DataTable
              aria-label="Bảng dữ liệu"
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
          {summary && <div className="primer-grid-summary">{summary(rows)}</div>}
          {view.length === 0 && !loading && <div className="primer-grid-empty">{locale?.emptyText ?? "Không có dữ liệu"}</div>}
        </div>
        {loading && (
          <div className="primer-grid-loading">
            <Spinner size="medium" />
          </div>
        )}
        {showFooter && (
          <div className="primer-grid-footer">
            <span className="primer-grid-total">
              {selected.size > 0 && <b className="primer-grid-picked">Đã chọn {selected.size} · </b>}
              {opts.showTotal ? opts.showTotal(total, [first, last]) : `${first}–${last} trong ${total}`}
            </span>
            {pageCount > 1 && <Pager current={page + 1} count={pageCount} onGo={go} />}
            {sizes && (
              <Select
                size="small"
                aria-label="Số dòng mỗi trang"
                value={size}
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
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}
