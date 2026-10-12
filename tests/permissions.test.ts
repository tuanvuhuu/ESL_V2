import { describe, expect, it } from "vitest";
import {
  canCreateRecords,
  canEditCenter,
  canEditTeachers,
  canManageSettings,
  canOpenPage,
  canSeeAllCenters,
  canSeeParents,
  canTakeAttendance,
  type Viewer,
} from "@/lib/permissions";
import { hashPassword, loginBlocked, recordLoginFailure, verifyPassword } from "@/server/auth";

const base = { id: 1, username: "x", fullName: "X", centerId: null, teacherId: null };
const manager: Viewer = { ...base, role: "MANAGER" };
const officeA: Viewer = { ...base, role: "OFFICE", centerId: 1 };
const teacher: Viewer = { ...base, role: "TEACHER", teacherId: 5 };
const assistant: Viewer = { ...base, role: "ASSISTANT", teacherId: 6 };

describe("phân quyền theo vai trò", () => {
  it("quản lý sửa được mọi trung tâm và chọn được tất cả trung tâm", () => {
    expect(canEditCenter(manager, 1)).toBe(true);
    expect(canEditCenter(manager, 4)).toBe(true);
    expect(canSeeAllCenters(manager)).toBe(true);
    expect(canManageSettings(manager)).toBe(true);
  });

  it("giáo vụ chỉ sửa trung tâm mình, không vào cài đặt, không sửa hồ sơ giáo viên", () => {
    expect(canEditCenter(officeA, 1)).toBe(true);
    expect(canEditCenter(officeA, 2)).toBe(false);
    expect(canEditCenter(officeA, null)).toBe(false);
    expect(canSeeAllCenters(officeA)).toBe(false);
    expect(canManageSettings(officeA)).toBe(false);
    expect(canEditTeachers(officeA)).toBe(false);
    expect(canSeeParents(officeA)).toBe(true);
  });

  it("giáo viên, trợ giảng chỉ xem: không sửa, không thấy phụ huynh, nhưng được điểm danh", () => {
    for (const v of [teacher, assistant]) {
      expect(canEditCenter(v, 1)).toBe(false);
      expect(canCreateRecords(v)).toBe(false);
      expect(canSeeParents(v)).toBe(false);
      expect(canTakeAttendance(v)).toBe(true);
    }
  });

  it("ẩn trang không có quyền", () => {
    expect(canOpenPage(officeA, "/settings")).toBe(false);
    expect(canOpenPage(teacher, "/parents")).toBe(false);
    expect(canOpenPage(teacher, "/teachers")).toBe(false);
    expect(canOpenPage(teacher, "/teachers/5")).toBe(true);
    expect(canOpenPage(teacher, "/teachers/7")).toBe(false);
    expect(canOpenPage(teacher, "/students/3")).toBe(true);
    expect(canOpenPage(manager, "/settings")).toBe(true);

    // Quyền trang mới: Tài chính, Lương, Báo cáo
    expect(canOpenPage(manager, "/finance")).toBe(true);
    expect(canOpenPage(officeA, "/finance")).toBe(true);
    expect(canOpenPage(teacher, "/finance")).toBe(false);

    expect(canOpenPage(manager, "/payroll")).toBe(true);
    expect(canOpenPage(officeA, "/payroll")).toBe(true);
    expect(canOpenPage(teacher, "/payroll")).toBe(false);
    expect(canOpenPage(teacher, "/my/payroll")).toBe(true);

    expect(canOpenPage(manager, "/reports")).toBe(true);
    expect(canOpenPage(officeA, "/reports")).toBe(true);
    expect(canOpenPage(teacher, "/reports")).toBe(false);
  });
});

describe("mật khẩu và chặn dò mật khẩu", () => {
  it("băm và kiểm tra mật khẩu", async () => {
    const h = await hashPassword("matkhau123");
    expect(h).not.toContain("matkhau123");
    expect(await verifyPassword("matkhau123", h)).toBe(true);
    expect(await verifyPassword("matkhau124", h)).toBe(false);
    expect(await verifyPassword("matkhau123", "rác")).toBe(false);
  });

  it("khóa sau 5 lần sai trong 15 phút, mở lại sau đó", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) recordLoginFailure("ai.do", t0);
    expect(loginBlocked("ai.do", t0)).toBe(false);
    recordLoginFailure("ai.do", t0);
    expect(loginBlocked("ai.do", t0 + 1000)).toBe(true);
    expect(loginBlocked("ai.do", t0 + 16 * 60 * 1000)).toBe(false);
  });
});
