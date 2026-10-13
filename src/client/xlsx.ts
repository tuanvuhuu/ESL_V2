"use client";

import { buildXlsx, XLSX_MIME, type XlsxCell, type XlsxSheet } from "@/lib/xlsx";

/** Xuất file .xlsx thật (mở bằng Excel, không cần đổi dấu tiếng Việt như CSV). Nhiều sheet thì truyền mảng sheet. */
export function downloadXlsx(filename: string, headerOrSheets: string[] | XlsxSheet[], rows?: XlsxCell[][]) {
  const sheets: XlsxSheet[] =
    headerOrSheets.length > 0 && typeof headerOrSheets[0] === "object"
      ? (headerOrSheets as XlsxSheet[])
      : [{ name: "Báo cáo", header: headerOrSheets as string[], rows: rows ?? [] }];
  const blob = new Blob([buildXlsx(sheets) as BlobPart], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}