import { describe, expect, it } from "vitest";
import { computeTotal, fillLessons, isValidScore, lessonForIndex, parseMaterials } from "@/lib/curriculum";
import { applyRenewal, sessionPriceOf } from "@/lib/finance";
import { scoreLine } from "@/lib/history";

describe("Điểm kiểm tra theo kỹ năng", () => {
  it("tổng tự tính là trung bình các kỹ năng đã nhập, làm tròn 1 chữ số", () => {
    expect(computeTotal({ listening: 7, speaking: 8, reading: 6.5, writing: 7 })).toBe(7.1);
    expect(computeTotal({ listening: 9, speaking: null })).toBe(9);
    expect(computeTotal({})).toBeNull();
  });
  it("tổng nhập tay được giữ nguyên", () => {
    expect(computeTotal({ listening: 5 }, 8.25)).toBe(8.3);
  });
  it("điểm hợp lệ trong thang 0–10", () => {
    expect(isValidScore(null)).toBe(true);
    expect(isValidScore(10)).toBe(true);
    expect(isValidScore(10.5)).toBe(false);
    expect(isValidScore(-1)).toBe(false);
    expect(isValidScore(Number.NaN)).toBe(false);
  });
  it("dòng điểm gửi phụ huynh", () => {
    const line = scoreLine({
      id: 1,
      kind: "MIDTERM",
      listening: 7,
      speaking: 8,
      reading: null,
      writing: null,
      total: 7.5,
      note: null,
      session: { index: 12, date: "2026-10-12", class: { code: "AL0001" } },
    });
    expect(line).toBe("Giữa khóa 12/10: Nghe 7, Nói 8 – tổng 7.5");
  });
});

describe("Khung chương trình", () => {
  it("buổi số N lấy bài số N", () => {
    const lessons = [
      { index: 1, title: "Unit 1", testKind: null },
      { index: 2, title: "Unit 1b", testKind: "QUIZ" },
    ];
    expect(lessonForIndex(lessons, 2)?.title).toBe("Unit 1b");
    expect(lessonForIndex(lessons, 3)).toBeNull();
  });
  it("tạo đủ số buổi mà không đè bài đã có", () => {
    const filled = fillLessons([{ index: 2, title: "Có sẵn" }], 3, (i) => ({ index: i, title: `Buổi ${i}` }));
    expect(filled.map((l) => l.title)).toEqual(["Buổi 1", "Có sẵn", "Buổi 3"]);
  });
  it("đọc danh sách tài liệu, bỏ link trống và JSON hỏng", () => {
    expect(parseMaterials('[{"name":"","url":" https://a.vn/x "},{"name":"b","url":""}]')).toEqual([{ name: "https://a.vn/x", url: "https://a.vn/x" }]);
    expect(parseMaterials("{hỏng")).toEqual([]);
    expect(parseMaterials(null)).toEqual([]);
  });
});

describe("Mua thêm buổi", () => {
  it("đơn giá gói làm tròn nghìn đồng", () => {
    expect(sessionPriceOf(5_400_000, 36)).toBe(150_000);
    expect(sessionPriceOf(1_000_000, 3)).toBe(333_000);
    expect(sessionPriceOf(1_000_000, 0)).toBe(0);
  });
  it("cộng số buổi và học phí", () => {
    expect(applyRenewal({ tuitionFee: 5_400_000, purchasedSessions: 36 }, { sessions: 8, amount: 1_200_000 })).toEqual({
      tuitionFee: 6_600_000,
      purchasedSessions: 44,
    });
  });
});
