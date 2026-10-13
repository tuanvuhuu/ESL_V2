// B7: file .xlsx tự ghi phải đọc lại được bằng thư viện đọc Excel của dự án (read-excel-file).
import { describe, expect, it } from "vitest";
import { readSheet } from "read-excel-file/browser";
import { buildXlsx, columnName, safeSheetName, XLSX_MIME } from "@/lib/xlsx";

const blobOf = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: XLSX_MIME });

describe("B7: ghi file xlsx", () => {
  it("tên cột kiểu Excel", () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  });

  it("tên sheet bỏ ký tự cấm và cắt 31 ký tự", () => {
    expect(safeSheetName("Doanh thu: 10/2026 [A]", "S")).toBe("Doanh thu  10 2026  A");
    expect(safeSheetName("x".repeat(40), "S")).toHaveLength(31);
    expect(safeSheetName("///", "S")).toBe("S");
  });

  it("đọc lại đúng chữ có dấu, số, ô trống và ký tự đặc biệt", async () => {
    const bytes = buildXlsx([
      {
        name: "Doanh thu",
        header: ["Trung tâm", "Thực thu", "Ghi chú"],
        rows: [
          ["Cầu Giấy", 12_500_000, "A & B <ok> \"q\""],
          ["Thanh Xuân", 0, null],
        ],
      },
    ]);
    // Chữ ký file ZIP
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const rows = (await readSheet(blobOf(bytes))) as unknown[][];
    expect(rows[0]).toEqual(["Trung tâm", "Thực thu", "Ghi chú"]);
    expect(rows[1][0]).toBe("Cầu Giấy");
    expect(rows[1][1]).toBe(12_500_000);
    expect(rows[1][2]).toBe('A & B <ok> "q"');
    expect(rows[2][0]).toBe("Thanh Xuân");
    expect(rows[2][1]).toBe(0);
  });

  it("nhiều sheet, đọc được sheet thứ hai", async () => {
    const bytes = buildXlsx([
      { name: "Một", header: ["a"], rows: [[1]] },
      { name: "Hai", header: ["b"], rows: [["x"], ["y"]] },
    ]);
    const second = (await readSheet(blobOf(bytes), 2)) as unknown[][];
    expect(second).toEqual([["b"], ["x"], ["y"]]);
  });
});