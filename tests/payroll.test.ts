// Tính lương theo giờ dạy và 3 cách tính khi đứng nhiều lớp trùng giờ.
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_TYPES,
  computeMonthlySalary,
  computeSessionPay,
  DEFAULT_OVERLAP_RATIO,
  detectOverlappingSessions,
  formatHours,
  OVERLAP_POLICIES,
  overlapCounts,
  PAYROLL_STATUSES,
  sessionBasePay,
  sessionHours,
  type TeachingSession,
} from "@/lib/payroll";

const session = (over: Partial<TeachingSession> = {}): TeachingSession => ({
  sessionId: 1,
  date: "2026-10-05",
  startTime: "18:00",
  endTime: "19:30",
  centerId: 1,
  role: "TEACHER",
  hourlyRate: 150000,
  ...over,
});

describe("tiền một buổi không trùng giờ", () => {
  it("lấy thời lượng từ giờ bắt đầu và kết thúc", () => {
    expect(sessionHours(session())).toBe(1.5);
    expect(sessionHours(session({ startTime: "09:00", endTime: "11:00" }))).toBe(2);
    expect(sessionHours(session({ startTime: "17:30", endTime: "18:00" }))).toBe(0.5);
  });

  it("ưu tiên durationMinutes nếu có", () => {
    expect(sessionHours(session({ durationMinutes: 60 }))).toBe(1);
    expect(sessionBasePay(session({ durationMinutes: 60 }))).toBe(150000);
  });

  it("tiền = số giờ × đơn giá giờ, làm tròn về đồng", () => {
    // 1,5 giờ × 150.000 = 225.000
    expect(computeSessionPay(session(), 1, "SINGLE")).toBe(225000);
    // Trợ giảng 2 giờ × 90.000 = 180.000
    expect(computeSessionPay(session({ role: "ASSISTANT", hourlyRate: 90000, endTime: "20:00" }), 1, "FULL")).toBe(180000);
    // 50 phút × 100.000 = 83.333,3 → 83.333
    expect(computeSessionPay(session({ endTime: "18:50", hourlyRate: 100000 }), 1, "FULL")).toBe(83333);
  });

  it("overlapCount ≤ 1 thì không áp chính sách trùng giờ", () => {
    expect(computeSessionPay(session(), 0, "SINGLE")).toBe(225000);
    expect(computeSessionPay(session(), 1, "FULL")).toBe(225000);
    expect(computeSessionPay(session(), 1, "RATIO")).toBe(225000);
  });
});

describe("3 cách tính khi trùng giờ", () => {
  // Hai lớp trùng giờ cùng ngày, cùng trung tâm, mỗi lớp 1,5 giờ × 150.000 = 225.000
  it("Tính 1 lần: chia đều tiền một buổi cho các buổi trùng", () => {
    expect(computeSessionPay(session(), 2, "SINGLE")).toBe(112500);
    expect(computeSessionPay(session(), 3, "SINGLE")).toBe(75000);
    // Cả nhóm 3 buổi trùng chỉ bằng tiền một buổi.
    expect(computeSessionPay(session(), 3, "SINGLE") * 3).toBe(225000);
  });

  it("Tính đủ từng lớp: mỗi buổi trùng vẫn tính đủ", () => {
    expect(computeSessionPay(session(), 2, "FULL")).toBe(225000);
    expect(computeSessionPay(session(), 3, "FULL")).toBe(225000);
    expect(computeSessionPay(session(), 3, "FULL") * 3).toBe(675000);
  });

  it("Tính theo hệ số: nhân hệ số mặc định 1,5 rồi chia đều", () => {
    // 1,5 × 150.000 × 1,5 / 2 = 168.750
    expect(computeSessionPay(session(), 2, "RATIO")).toBe(168750);
    // 1,5 × 150.000 × 1,5 / 3 = 112.500
    expect(computeSessionPay(session(), 3, "RATIO")).toBe(112500);
    expect(DEFAULT_OVERLAP_RATIO).toBe(1.5);
  });

  it("Tính theo hệ số: dùng hệ số do người dùng đặt", () => {
    // 1,5 × 150.000 × 2 / 2 = 225.000
    expect(computeSessionPay(session(), 2, "RATIO", 2)).toBe(225000);
    // Hệ số 1,5 cho 2 buổi trùng bằng 1,5 lần tiền một buổi.
    expect(computeSessionPay(session(), 2, "RATIO", 1.5) * 2).toBe(337500);
    // Hệ số cao hơn thì tiền mỗi buổi trùng cao hơn cách tính 1 lần.
    expect(computeSessionPay(session(), 2, "RATIO", 2)).toBeGreaterThan(computeSessionPay(session(), 2, "SINGLE"));
  });

  it("Hệ số không hợp lệ thì lấy hệ số mặc định", () => {
    expect(computeSessionPay(session(), 2, "RATIO", 0)).toBe(168750);
    expect(computeSessionPay(session(), 2, "RATIO", -1)).toBe(168750);
    expect(computeSessionPay(session(), 2, "RATIO", Number.NaN)).toBe(168750);
  });
});

describe("phát hiện buổi trùng giờ", () => {
  it("cùng ngày, chồng giờ thì vào một nhóm", () => {
    const groups = detectOverlappingSessions([
      session({ sessionId: 1, startTime: "18:00", endTime: "19:30" }),
      session({ sessionId: 2, startTime: "19:00", endTime: "20:30" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((s) => s.sessionId)).toEqual([1, 2]);
  });

  it("khác ngày hoặc sát giờ thì không trùng", () => {
    expect(
      detectOverlappingSessions([
        session({ sessionId: 1, date: "2026-10-05", startTime: "18:00", endTime: "19:30" }),
        session({ sessionId: 2, date: "2026-10-06", startTime: "18:00", endTime: "19:30" }),
        session({ sessionId: 3, startTime: "19:30", endTime: "21:00" }),
      ]),
    ).toEqual([]);
    expect(detectOverlappingSessions([])).toEqual([]);
  });

  it("gộp liên thông: A trùng B, B trùng C thì cả ba vào một nhóm", () => {
    const groups = detectOverlappingSessions([
      session({ sessionId: 1, startTime: "18:00", endTime: "19:30" }),
      session({ sessionId: 2, startTime: "19:00", endTime: "20:30" }),
      session({ sessionId: 3, startTime: "20:00", endTime: "21:30" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((s) => s.sessionId)).toEqual([1, 2, 3]);
  });

  it("tách được nhiều nhóm trong một ngày và sắp theo ngày, giờ", () => {
    const groups = detectOverlappingSessions([
      session({ sessionId: 1, date: "2026-10-07", startTime: "09:00", endTime: "10:30" }),
      session({ sessionId: 2, date: "2026-10-07", startTime: "09:30", endTime: "11:00" }),
      session({ sessionId: 3, date: "2026-10-05", startTime: "14:00", endTime: "15:30" }),
      session({ sessionId: 4, date: "2026-10-05", startTime: "15:00", endTime: "16:30" }),
    ]);
    expect(groups.map((g) => g.map((s) => s.sessionId))).toEqual([
      [3, 4],
      [1, 2],
    ]);
  });

  it("đếm số buổi trùng của từng buổi", () => {
    const counts = overlapCounts([
      session({ sessionId: 1, startTime: "18:00", endTime: "19:30" }),
      session({ sessionId: 2, startTime: "19:00", endTime: "20:30" }),
      session({ sessionId: 3, startTime: "20:00", endTime: "21:30" }),
      session({ sessionId: 4, date: "2026-10-06", startTime: "09:00", endTime: "10:30" }),
    ]);
    expect(counts.get(1)).toBe(3);
    expect(counts.get(2)).toBe(3);
    expect(counts.get(3)).toBe(3);
    expect(counts.get(4)).toBe(1);
  });
});

describe("bảng lương tháng", () => {
  // Buổi 1 và 2 trùng nhau 30 phút ngày 05; buổi 3, 4 độc lập.
  const month: TeachingSession[] = [
    session({ sessionId: 1, startTime: "18:00", endTime: "19:30", hourlyRate: 150000 }),
    session({ sessionId: 2, startTime: "19:00", endTime: "20:30", hourlyRate: 150000 }),
    session({ sessionId: 3, date: "2026-10-07", startTime: "09:00", endTime: "11:00", hourlyRate: 150000 }),
    session({ sessionId: 4, date: "2026-10-08", startTime: "14:00", endTime: "15:30", role: "ASSISTANT", hourlyRate: 90000 }),
  ];

  it("tổng hợp số giờ, tiền dạy và chi tiết từng buổi", () => {
    const r = computeMonthlySalary({ sessions: month, overlapPolicy: "SINGLE" });
    expect(r.totalHours).toBe(6.5);
    // 112.500 + 112.500 + 300.000 + 135.000
    expect(r.teachingPay).toBe(660000);
    expect(r.adjustmentTotal).toBe(0);
    expect(r.finalSalary).toBe(660000);
    expect(r.sessionDetails).toEqual([
      { sessionId: 1, date: "2026-10-05", startTime: "18:00", endTime: "19:30", centerId: 1, role: "TEACHER", hours: 1.5, basePay: 225000, overlapCount: 2, pay: 112500 },
      { sessionId: 2, date: "2026-10-05", startTime: "19:00", endTime: "20:30", centerId: 1, role: "TEACHER", hours: 1.5, basePay: 225000, overlapCount: 2, pay: 112500 },
      { sessionId: 3, date: "2026-10-07", startTime: "09:00", endTime: "11:00", centerId: 1, role: "TEACHER", hours: 2, basePay: 300000, overlapCount: 1, pay: 300000 },
      { sessionId: 4, date: "2026-10-08", startTime: "14:00", endTime: "15:30", centerId: 1, role: "ASSISTANT", hours: 1.5, basePay: 135000, overlapCount: 1, pay: 135000 },
    ]);
  });

  it("áp đúng 3 chính sách trùng giờ cho cả tháng", () => {
    const single = computeMonthlySalary({ sessions: month, overlapPolicy: "SINGLE" });
    const full = computeMonthlySalary({ sessions: month, overlapPolicy: "FULL" });
    const ratio = computeMonthlySalary({ sessions: month, overlapPolicy: "RATIO" });
    expect(single.teachingPay).toBe(660000);
    // 225.000 × 2 + 300.000 + 135.000
    expect(full.teachingPay).toBe(885000);
    // 168.750 × 2 + 300.000 + 135.000
    expect(ratio.teachingPay).toBe(772500);
    // Số giờ dạy không đổi theo cách tính tiền.
    expect(full.totalHours).toBe(single.totalHours);
    expect(ratio.totalHours).toBe(single.totalHours);
  });

  it("hệ số riêng cho tháng: RATIO với hệ số 2", () => {
    const r = computeMonthlySalary({ sessions: month, overlapPolicy: "RATIO", defaultRatio: 2 });
    // 1,5 × 150.000 × 2 / 2 = 225.000 mỗi buổi trùng
    expect(r.teachingPay).toBe(225000 + 225000 + 300000 + 135000);
  });

  it("cộng thưởng, phụ cấp và trừ phạt", () => {
    const r = computeMonthlySalary({
      sessions: month,
      overlapPolicy: "SINGLE",
      adjustments: [
        { type: "BONUS", amount: 200000, note: "Thưởng chuyên cần tháng 10" },
        { type: "ALLOWANCE", amount: 120000, note: "Phụ cấp đi lại" },
        { type: "PENALTY", amount: 50000, note: "Phạt điểm danh muộn" },
      ],
    });
    expect(r.adjustmentTotal).toBe(270000);
    expect(r.teachingPay).toBe(660000);
    expect(r.finalSalary).toBe(930000);
  });

  it("không có buổi nào thì lương 0, không lỗi", () => {
    expect(computeMonthlySalary({ sessions: [] })).toEqual({
      totalHours: 0,
      teachingPay: 0,
      adjustmentTotal: 0,
      finalSalary: 0,
      sessionDetails: [],
    });
  });

  it("chỉ tính buổi đã dạy đủ thời lượng, buổi vắng không có trong danh sách", () => {
    const r = computeMonthlySalary({ sessions: [session({ sessionId: 9, durationMinutes: 60 })] });
    expect(r.totalHours).toBe(1);
    expect(r.teachingPay).toBe(150000);
    expect(r.sessionDetails[0].basePay).toBe(150000);
  });
});

describe("danh mục và định dạng", () => {
  it("đủ 3 chính sách trùng giờ và 3 trạng thái bảng lương", () => {
    expect(OVERLAP_POLICIES.map((p) => p.value)).toEqual(["SINGLE", "FULL", "RATIO"]);
    expect(OVERLAP_POLICIES.map((p) => p.label)).toEqual(["Tính 1 lần", "Tính đủ từng lớp", "Tính theo hệ số"]);
    expect(PAYROLL_STATUSES.map((s) => s.value)).toEqual(["DRAFT", "LOCKED", "PAID"]);
    expect(PAYROLL_STATUSES.map((s) => s.label)).toEqual(["Bản nháp", "Đã chốt", "Đã thanh toán"]);
    expect(ADJUSTMENT_TYPES.map((a) => a.value)).toEqual(["BONUS", "ALLOWANCE", "PENALTY"]);
  });

  it("định dạng số giờ", () => {
    expect(formatHours(2.5)).toBe("2 giờ 30 phút");
    expect(formatHours(2)).toBe("2 giờ");
    expect(formatHours(0.5)).toBe("30 phút");
    expect(formatHours(0)).toBe("0 phút");
  });
});
