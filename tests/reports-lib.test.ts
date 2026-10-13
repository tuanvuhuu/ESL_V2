import { describe, expect, it } from "vitest";
import { computeRetention, daysBetween, monthRange, overlapMinutes, percent, roomUsage } from "@/lib/reports";

describe("Phép tính báo cáo", () => {
  it("khoảng ngày của tháng, kể cả tháng 2 năm nhuận", () => {
    expect(monthRange("2026-10")).toEqual(["2026-10-01", "2026-10-31"]);
    expect(monthRange("2028-02")).toEqual(["2028-02-01", "2028-02-29"]);
    expect(daysBetween("2026-10-30", "2026-11-02")).toHaveLength(4);
  });
  it("phần trăm, mẫu 0 thì không có số liệu", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(1, 0)).toBeNull();
  });
  it("tỷ lệ học tiếp không tính chuyển lớp", () => {
    const ended = [
      { id: 1, studentId: 10, joinedAt: "2026-01-01", transferredFromId: null },
      { id: 2, studentId: 11, joinedAt: "2026-01-01", transferredFromId: null },
    ];
    const all = [
      ...ended,
      { id: 3, studentId: 10, joinedAt: "2026-06-01", transferredFromId: null },
      { id: 4, studentId: 11, joinedAt: "2026-06-01", transferredFromId: 2 },
    ];
    expect(computeRetention(ended, all)).toEqual({ ended: 2, continued: 1, rate: 50 });
  });
  it("sử dụng phòng theo khung giờ", () => {
    expect(overlapMinutes("11:00", "13:00", "12:00", "17:00")).toBe(60);
    // Một ngày mở cửa, một buổi 18:00–20:00: tối 120/240 = 50%, cả ngày 120/780.
    const u = roomUsage([{ roomId: 1, startTime: "18:00", endTime: "20:00" }], 1);
    expect(u.parts).toEqual({ morning: 0, afternoon: 0, evening: 50 });
    expect(u.rate).toBe(15);
    expect(u.hours).toBe(2);
    expect(roomUsage([], 0).rate).toBe(0);
  });
});
