import { describe, expect, it } from "vitest";
import { addDays, ageFrom, formatDateVN, isValidISODate, isoWeekday, startOfWeek } from "@/lib/dates";

describe("dates", () => {
  it("thứ trong tuần: 12/10/2026 là Thứ 2", () => {
    expect(isoWeekday("2026-10-12")).toBe(1);
    expect(isoWeekday("2026-10-18")).toBe(7);
  });
  it("tuần bắt đầu từ Thứ 2", () => {
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
  });
  it("cộng ngày qua tháng, năm", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("định dạng Việt Nam", () => {
    expect(formatDateVN("2026-10-12", true)).toBe("T2, 12/10/2026");
  });
  it("ngày không hợp lệ", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-02-28")).toBe(true);
  });
  it("tính tuổi", () => {
    expect(ageFrom("2016-10-13", "2026-10-12")).toBe(9);
    expect(ageFrom("2016-10-12", "2026-10-12")).toBe(10);
  });
});
