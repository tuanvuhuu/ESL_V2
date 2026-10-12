import { describe, expect, it } from "vitest";
import { chargeOf, computeBalance, formatMinutes, nextAttendanceStatus, sessionMinutes } from "@/lib/attendance";

describe("số buổi còn lại", () => {
  it("có mặt, đi muộn, vắng không phép trừ buổi; vắng có phép không trừ", () => {
    const b = computeBalance(10, 0, [{ status: "PRESENT" }, { status: "LATE" }, { status: "UNEXCUSED" }, { status: "EXCUSED" }]);
    expect(b).toEqual({ purchased: 10, used: 3, adjustment: 0, remaining: 7 });
  });

  it("điều chỉnh tay cộng / trừ vào số còn lại", () => {
    expect(computeBalance(10, 2, [{ status: "PRESENT" }]).remaining).toBe(11);
    expect(computeBalance(10, -3, []).remaining).toBe(7);
  });

  it("học bù cho buổi vắng có phép thì trừ 1 buổi, cho buổi vắng không phép thì không trừ thêm", () => {
    expect(chargeOf({ status: "PRESENT", makeupOfStatus: "EXCUSED" })).toBe(1);
    expect(chargeOf({ status: "PRESENT", makeupOfStatus: "UNEXCUSED" })).toBe(0);
    const b = computeBalance(5, 0, [{ status: "EXCUSED" }, { status: "PRESENT", makeupOfStatus: "EXCUSED" }]);
    expect(b.remaining).toBe(4);
  });

  it("có thể âm khi học quá số buổi đã mua", () => {
    expect(computeBalance(1, 0, [{ status: "PRESENT" }, { status: "PRESENT" }]).remaining).toBe(-1);
  });
});

describe("điểm danh", () => {
  it("chạm đổi theo vòng Có mặt → Muộn → Vắng có phép → Vắng không phép → Có mặt", () => {
    expect(nextAttendanceStatus("PRESENT")).toBe("LATE");
    expect(nextAttendanceStatus("LATE")).toBe("EXCUSED");
    expect(nextAttendanceStatus("EXCUSED")).toBe("UNEXCUSED");
    expect(nextAttendanceStatus("UNEXCUSED")).toBe("PRESENT");
  });

  it("tính giờ dạy của buổi", () => {
    expect(sessionMinutes("17:30", "19:00")).toBe(90);
    expect(formatMinutes(90)).toBe("1 giờ 30 phút");
    expect(formatMinutes(120)).toBe("2 giờ");
    expect(formatMinutes(45)).toBe("45 phút");
  });
});
