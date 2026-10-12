"use client";

import { PrimerGrid, type PrimerGridProps } from "./PrimerGrid";

export type DataGridProps<T extends object = any> = PrimerGridProps<T> & {
  maxHeight?: string;
  minWidth?: number;
};

export function DataGrid<T extends object = any>(props: DataGridProps<T>) {
  return <PrimerGrid<T> {...props} />;
}