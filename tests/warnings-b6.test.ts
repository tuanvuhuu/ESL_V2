// B6: cảnh báo (không chặn) khi học sinh còn nợ khóa trước và khi giáo viên dạy 2 trung tâm sát giờ.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findTightGaps, type SlotLite } from "@/lib/schedule";
import { prisma } from "@/server/db";
import { priorDebtsForStudent } from "@/server/finance";

const slot = (over: Partial<SlotLite>): SlotLite => ({
  date: "2026-03-02", startTime: "08:00", endTime: "09:30", roomId: 1, centerId: 1, centerName: "TT A", classCode: "A1", staffIds: [7], ...over,
});

describe("B6: giáo viên dạy 2 trung tâm sát giờ", () => {
  const names = { 7: "Ms Lan" };
  it("cách dưới 60 phút ở trung tâm khác thì cảnh báo", () => {
    const w = findTightGaps([slot({ startTime: "09:50", endTime: "11:00", centerId: 2 })], [slot({})], names);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("Ms Lan");
    expect(w[0]).toContain("20 phút");
  });

  it("cách đủ 60 phút, cùng trung tâm, khác người, hoặc trùng giờ thì không cảnh báo", () => {
    expect(findTightGaps([slot({ startTime: "10:30", endTime: "12:00", centerId: 2 })], [slot({})], names)).toEqual([]);
    expect(findTightGaps([slot({ startTime: "09:40", endTime: "11:00", centerId: 1 })], [slot({})], names)).toEqual([]);
    expect(findTightGaps([slot({ startTime: "09:40", endTime: "11:00", centerId: 2, staffIds: [8] })], [slot({})], names)).toEqual([]);
    expect(findTightGaps([slot({ startTime: "09:00", endTime: "10:00", centerId: 2 })], [slot({})], names)).toEqual([]);
  });

  it("buổi trước đó cũng được tính, hai chiều", () => {
    const w = findTightGaps([slot({ startTime: "07:00", endTime: "07:40", centerId: 2 })], [slot({})], names);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("20 phút");
  });
});

describe("B6: còn nợ khóa trước", () => {
  let enrollmentId = 0;
  let studentId = 0;
  let classId = 0;
  let original: { tuitionFee: number | null; dueDate: string | null } = { tuitionFee: null, dueDate: null };

  beforeAll(async () => {
    const e = await prisma.classEnrollment.findFirstOrThrow({ where: { leftAt: null, class: { status: { in: ["ACTIVE", "PLANNED"] } } } });
    enrollmentId = e.id;
    studentId = e.studentId;
    classId = e.classId;
    original = { tuitionFee: e.tuitionFee, dueDate: e.dueDate };
    await prisma.classEnrollment.update({ where: { id: e.id }, data: { tuitionFee: 987_000_000, dueDate: "2020-01-01" } });
  });

  afterAll(async () => {
    await prisma.classEnrollment.update({ where: { id: enrollmentId }, data: original });
    await prisma.$disconnect();
  });

  it("ghi danh ở lớp khác còn nợ thì báo nợ khóa trước, quá hạn", async () => {
    const debts = await priorDebtsForStudent(prisma, studentId, -1);
    const d = debts.find((x) => x.enrollmentId === enrollmentId);
    expect(d).toBeDefined();
    expect(d!.debtAmount).toBeGreaterThan(0);
    expect(d!.isOverdue).toBe(true);
  });

  it("không tự báo nợ của chính lớp đang xếp", async () => {
    const debts = await priorDebtsForStudent(prisma, studentId, classId);
    expect(debts.find((x) => x.enrollmentId === enrollmentId)).toBeUndefined();
  });
});