import { describe, expect, it } from "vitest";
import { findConflicts, generateSessionDates, overlaps, type SlotLite } from "@/lib/schedule";

describe("generateSessionDates", () => {
  it("sinh buổi theo thứ 2-4-6 từ ngày khai giảng", () => {
    const { dates } = generateSessionDates({ startDate: "2026-10-12", weekdays: [1, 3, 5], totalSessions: 5, centerId: 1, holidays: [] });
    expect(dates).toEqual(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-19", "2026-10-21"]);
  });

  it("khai giảng giữa tuần thì bắt đầu từ thứ học gần nhất", () => {
    const { dates } = generateSessionDates({ startDate: "2026-10-13", weekdays: [1, 3], totalSessions: 2, centerId: 1, holidays: [] });
    expect(dates).toEqual(["2026-10-14", "2026-10-19"]);
  });

  it("bỏ ngày lễ chung và ngày lễ của trung tâm mình, giữ đủ số buổi", () => {
    const { dates, skipped } = generateSessionDates({
      startDate: "2026-10-12",
      weekdays: [1, 3, 5],
      totalSessions: 3,
      centerId: 1,
      holidays: [
        { date: "2026-10-14", centerId: null, name: "Nghỉ chung" },
        { date: "2026-10-16", centerId: 2, name: "Chỉ trung tâm 2" },
      ],
    });
    expect(dates).toEqual(["2026-10-12", "2026-10-16", "2026-10-19"]);
    expect(skipped).toEqual([{ date: "2026-10-14", name: "Nghỉ chung" }]);
  });

  it("không có thứ nào thì không sinh buổi", () => {
    expect(generateSessionDates({ startDate: "2026-10-12", weekdays: [], totalSessions: 3, centerId: 1, holidays: [] }).dates).toEqual([]);
  });
});

describe("overlaps", () => {
  it("giờ sát nhau không tính trùng", () => {
    expect(overlaps("18:00", "19:30", "19:30", "21:00")).toBe(false);
    expect(overlaps("18:00", "19:30", "19:00", "20:00")).toBe(true);
  });
});

const slot = (p: Partial<SlotLite>): SlotLite => ({
  date: "2026-10-14",
  startTime: "18:00",
  endTime: "19:30",
  roomId: 1,
  centerId: 1,
  staffIds: [10],
  ...p,
});

describe("findConflicts", () => {
  it("chặn trùng phòng", () => {
    const c = findConflicts([slot({ staffIds: [11] })], [slot({ sessionId: 5, classCode: "KID2-Lions", roomName: "P201", staffIds: [12] })]);
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe("ROOM");
    expect(c[0].message).toContain("Phòng P201 đã có lớp KID2-Lions lúc 18:00–19:30 T4, 14/10/2026");
  });

  it("cho phép một người đứng nhiều lớp trùng giờ trong cùng trung tâm", () => {
    expect(findConflicts([slot({ roomId: 2 })], [slot({ sessionId: 5, roomId: 1 })])).toEqual([]);
  });

  it("chặn một người dạy trùng giờ ở hai trung tâm khác nhau", () => {
    const c = findConflicts(
      [slot({ roomId: 2, centerId: 1 })],
      [slot({ sessionId: 5, roomId: 9, centerId: 2, centerName: "Trung tâm B", classCode: "IELTS-A" })],
      { 10: "Ms Lan" },
    );
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe("STAFF");
    expect(c[0].message).toContain("Ms Lan đang dạy lớp IELTS-A ở Trung tâm B");
  });

  it("trợ giảng cũng bị kiểm tra trùng giữa hai trung tâm", () => {
    const c = findConflicts([slot({ roomId: 2, staffIds: [10, 20] })], [slot({ sessionId: 5, roomId: 9, centerId: 2, staffIds: [30, 20] })]);
    expect(c.map((x) => x.staffId)).toEqual([20]);
  });

  it("không so buổi với chính nó và bỏ qua khác ngày, khác giờ", () => {
    expect(findConflicts([slot({ sessionId: 5 })], [slot({ sessionId: 5 })])).toEqual([]);
    expect(findConflicts([slot({})], [slot({ sessionId: 5, date: "2026-10-15" })])).toEqual([]);
    expect(findConflicts([slot({})], [slot({ sessionId: 5, startTime: "19:30", endTime: "21:00" })])).toEqual([]);
  });
});
