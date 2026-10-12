// Lịch sử học tập theo khóa: gộp chuyển lớp, chuyên cần, tự đổi trạng thái lớp.
import { describe, expect, it } from "vitest";
import { buildCourseHistory, summarize, type HistoryEnrollment } from "@/lib/history";
import { autoClassStatus } from "@/lib/schedule";

const att = (id: number, status: string, date: string, extra: Partial<{ makeupId: number | null; comment: string | null }> = {}) => ({
  id,
  status,
  comment: extra.comment ?? null,
  makeupId: extra.makeupId ?? null,
  session: { index: id, date, startTime: "18:00", lessonContent: null, class: { code: "A" } },
});

const enr = (id: number, classCode: string, joinedAt: string, leftAt: string | null, from: number | null, attendances: ReturnType<typeof att>[], classStatus = "ACTIVE"): HistoryEnrollment => ({
  id,
  joinedAt,
  leftAt,
  transferredFromId: from,
  outcome: null,
  finalComment: null,
  outcomeBy: null,
  balance: null,
  attendances,
  class: { id: id * 10, code: classCode, name: classCode, status: classStatus, teacher: { displayName: "Ms Lan" }, course: { name: "Kids 1" }, center: { name: "A", color: "#000" } },
});

describe("lịch sử theo khóa", () => {
  it("gộp lớp chuyển trong cùng khóa thành một thẻ", () => {
    const first = enr(1, "A1", "2026-01-05", "2026-02-01", null, [att(1, "PRESENT", "2026-01-06")]);
    const second = enr(2, "A2", "2026-02-01", null, 1, [att(2, "UNEXCUSED", "2026-02-03"), att(3, "PRESENT", "2026-02-05", { comment: "Tốt" })]);
    const runs = buildCourseHistory([first, second]);
    expect(runs).toHaveLength(1);
    expect(runs[0].enrollments.map((e) => e.id)).toEqual([1, 2]);
    expect(runs[0].ongoing).toBe(true);
    expect(runs[0].summary).toMatchObject({ held: 3, present: 2, unexcused: 1 });
    expect(runs[0].summary.rate).toBe(67);
    expect(runs[0].comments).toEqual([{ date: "2026-02-05", classCode: "A", comment: "Tốt" }]);
  });

  it("tách các khóa khác nhau, khóa mới nhất đứng trước", () => {
    const old = enr(1, "A1", "2025-09-01", "2025-12-01", null, [], "FINISHED");
    const cur = enr(2, "A2", "2026-01-05", null, null, []);
    const runs = buildCourseHistory([old, cur]);
    expect(runs.map((r) => r.key)).toEqual([2, 1]);
    expect(runs[1].ongoing).toBe(false);
  });

  it("học bù tính vào số buổi đi học, không tính vào số buổi của lớp", () => {
    const s = summarize([
      { status: "EXCUSED", makeupId: null },
      { status: "PRESENT", makeupId: 9 },
      { status: "PRESENT", makeupId: null },
    ]);
    expect(s.held).toBe(2);
    expect(s.madeUp).toBe(1);
    expect(s.rate).toBe(100);
  });
});

describe("tự đổi trạng thái lớp", () => {
  it("lớp dự kiến đến buổi đầu thành đang học, qua buổi cuối thành đã kết thúc", () => {
    expect(autoClassStatus("PLANNED", "2026-10-13", "2026-12-01", "2026-10-12")).toBe("PLANNED");
    expect(autoClassStatus("PLANNED", "2026-10-12", "2026-12-01", "2026-10-12")).toBe("ACTIVE");
    expect(autoClassStatus("ACTIVE", "2026-01-01", "2026-10-11", "2026-10-12")).toBe("FINISHED");
    expect(autoClassStatus("SUSPENDED", "2026-01-01", "2026-10-11", "2026-10-12")).toBe("SUSPENDED");
  });
});
