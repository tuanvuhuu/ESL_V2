import { describe, expect, it } from "vitest";
import { mapHeader, parseCsv, parseDateCell, parseGender, parseNumberCell, tableToRows, templateCsv, validateRow } from "@/lib/importer";

describe("Đọc file nhập học sinh", () => {
  it("đọc CSV có BOM, ngoặc kép, dấu chấm phẩy", () => {
    expect(parseCsv('﻿a;b\r\n"x;1";"say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x;1", 'say "hi"'],
    ]);
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("nhận tiêu đề không dấu, khác hoa thường và tên khác", () => {
    const map = mapHeader(["HO TEN", "Ngày sinh", "sdt", "Mã TT", "phụ huynh", "xyz"]);
    expect(map).toEqual({ fullName: 0, dob: 1, parentPhone: 2, centerCode: 3, parentName: 4 });
  });
  it("file mẫu đọc lại đủ cột, không thiếu cột bắt buộc", () => {
    const { rows, missing } = tableToRows(parseCsv(templateCsv()));
    expect(missing).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(validateRow(rows[0], "2026-10-13").errors).toEqual([]);
  });
  it("báo thiếu cột bắt buộc", () => {
    expect(tableToRows([["Họ tên học sinh"]]).missing).toContain("Ngày sinh");
  });
  it("đọc ngày nhiều kiểu", () => {
    expect(parseDateCell("05/03/2016")).toBe("2016-03-05");
    expect(parseDateCell("2016-3-5")).toBe("2016-03-05");
    expect(parseDateCell(new Date(Date.UTC(2016, 2, 5)))).toBe("2016-03-05");
    expect(parseDateCell(42434)).toBe("2016-03-05");
    expect(parseDateCell("31/02/2016")).toBeNull();
  });
  it("đọc số tiền có dấu phân cách", () => {
    expect(parseNumberCell("1.500.000")).toBe(1_500_000);
    expect(parseNumberCell("1,500,000 ₫")).toBe(1_500_000);
    expect(parseNumberCell("7,5")).toBe(7.5);
    expect(parseNumberCell("")).toBeNull();
    expect(parseNumberCell("abc")).toBeNaN();
  });
  it("giới tính", () => {
    expect(parseGender("Nữ")).toBe("FEMALE");
    expect(parseGender("nam")).toBe("MALE");
    expect(parseGender("?")).toBeNull();
  });
  it("kiểm tra dòng: chuẩn hóa SĐT mất số 0, suy ra nhóm tuổi", () => {
    const { row, errors } = validateRow(
      { fullName: " Lê Vy ", dob: "01/01/2017", centerCode: "a", parentName: "Lê Hà", parentPhone: 912345678, classCode: "al0001", remainingSessions: "10" },
      "2026-10-13",
    );
    expect(errors).toEqual([]);
    expect(row).toMatchObject({ fullName: "Lê Vy", parentPhone: "0912345678", centerCode: "A", classCode: "AL0001", remainingSessions: 10, audience: "PRIMARY", gender: "MALE" });
  });
  it("kiểm tra dòng: gom đủ lỗi", () => {
    const { row, errors } = validateRow({ fullName: "", dob: "x", centerCode: "", parentName: "", parentPhone: "123", remainingSessions: "2.5", debt: "100000" });
    expect(row).toBeNull();
    expect(errors).toEqual(
      expect.arrayContaining(["Thiếu họ tên học sinh", "Thiếu mã trung tâm", "Thiếu tên phụ huynh", "Số buổi còn lại phải là số nguyên 0–300", "Có công nợ thì cần mã lớp để gắn vào ghi danh"]),
    );
  });
});
