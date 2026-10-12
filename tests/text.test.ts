import { describe, expect, it } from "vitest";
import { buildSearchText, formatPhone, isValidPhone, normalizeQuery, normalizeVi } from "@/lib/text";

describe("normalizeVi", () => {
  it("bỏ dấu và chữ hoa, đổi đ thành d", () => {
    expect(normalizeVi("Nguyễn Đức  Anh")).toBe("nguyen duc anh");
    expect(normalizeVi("ĐẶNG THỊ HẰNG")).toBe("dang thi hang");
  });
});

describe("tìm kiếm", () => {
  it('"nguyen" khớp "Nguyễn"', () => {
    const text = buildSearchText(["Nguyễn Minh An", "0912 345 678"]);
    expect(text.includes(normalizeQuery("nguyen"))).toBe(true);
  });
  it("tìm SĐT có dấu cách", () => {
    const text = buildSearchText(["0912345678"]);
    expect(text.includes(normalizeQuery("0912 345"))).toBe(true);
    expect(text.includes(normalizeQuery("345 678"))).toBe(true);
  });
});

describe("SĐT", () => {
  it("kiểm tra 10 số, bắt đầu bằng 0", () => {
    expect(isValidPhone("0912 345 678")).toBe(true);
    expect(isValidPhone("912345678")).toBe(false);
    expect(isValidPhone("09123456789")).toBe(false);
  });
  it("định dạng 0912 345 678", () => {
    expect(formatPhone("0912345678")).toBe("0912 345 678");
  });
});
