import { describe, expect, it } from "vitest";
import { availabilityFor, inRange, normalizeSlots, rangesOverlap, reservationCovers } from "@/lib/availability";

// 2026-10-12 là Thứ 2.
const slots = [
  { weekday: 1, startTime: "17:00", endTime: "21:00", centerId: null },
  { weekday: 6, startTime: "08:00", endTime: "12:00", centerId: 2 },
];

describe("availabilityFor", () => {
  it("buổi nằm trọn trong khung rảnh là Rảnh", () => {
    expect(availabilityFor(slots, "2026-10-12", "17:30", "19:00", 1)).toBe("FREE");
  });
  it("buổi vượt ra ngoài khung là Ngoài lịch rảnh", () => {
    expect(availabilityFor(slots, "2026-10-12", "20:00", "21:30", 1)).toBe("OUTSIDE");
    expect(availabilityFor(slots, "2026-10-13", "17:30", "19:00", 1)).toBe("OUTSIDE");
  });
  it("khung gắn trung tâm chỉ tính ở trung tâm đó", () => {
    expect(availabilityFor(slots, "2026-10-17", "08:30", "10:00", 2)).toBe("FREE");
    expect(availabilityFor(slots, "2026-10-17", "08:30", "10:00", 1)).toBe("OUTSIDE");
  });
  it("chưa khai lịch rảnh thì không đánh giá", () => {
    expect(availabilityFor([], "2026-10-12", "17:30", "19:00", 1)).toBe("UNKNOWN");
  });
});

describe("normalizeSlots", () => {
  it("gộp khung trùng hoặc nối tiếp trong cùng thứ, cùng trung tâm", () => {
    expect(
      normalizeSlots([
        { weekday: 2, startTime: "18:00", endTime: "20:00", centerId: null },
        { weekday: 2, startTime: "17:00", endTime: "18:00", centerId: null },
        { weekday: 2, startTime: "19:00", endTime: "21:00", centerId: null },
        { weekday: 2, startTime: "19:00", endTime: "21:00", centerId: 3 },
        { weekday: 1, startTime: "08:00", endTime: "09:00", centerId: null },
      ]),
    ).toEqual([
      { weekday: 1, startTime: "08:00", endTime: "09:00", centerId: null },
      { weekday: 2, startTime: "17:00", endTime: "21:00", centerId: null },
      { weekday: 2, startTime: "19:00", endTime: "21:00", centerId: 3 },
    ]);
  });
});

describe("khoảng ngày nghỉ và bảo lưu", () => {
  it("ngày nghỉ tính cả hai đầu", () => {
    const r = { fromDate: "2026-10-13", toDate: "2026-10-15" };
    expect(inRange(r, "2026-10-13")).toBe(true);
    expect(inRange(r, "2026-10-15")).toBe(true);
    expect(inRange(r, "2026-10-16")).toBe(false);
    expect(rangesOverlap(r, { fromDate: "2026-10-15", toDate: "2026-10-20" })).toBe(true);
    expect(rangesOverlap(r, { fromDate: "2026-10-16", toDate: "2026-10-20" })).toBe(false);
  });
  it("bảo lưu áp dụng từ ngày bắt đầu đến trước ngày học lại", () => {
    expect(reservationCovers({ startDate: "2026-10-01", returnedAt: null }, "2026-12-01")).toBe(true);
    expect(reservationCovers({ startDate: "2026-10-01", returnedAt: null }, "2026-09-30")).toBe(false);
    expect(reservationCovers({ startDate: "2026-10-01", returnedAt: "2026-10-20" }, "2026-10-19")).toBe(true);
    expect(reservationCovers({ startDate: "2026-10-01", returnedAt: "2026-10-20" }, "2026-10-20")).toBe(false);
  });
});
