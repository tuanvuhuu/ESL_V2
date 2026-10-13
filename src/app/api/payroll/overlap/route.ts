import { UpdateTeacherOverlapInput, listTeacherOverlapHistory, updateTeacherOverlapSettings } from "@/server/payroll";
import { allow, body, idParam, route } from "@/server/http";
import { canSeePayroll } from "@/lib/permissions";

/** B4: lịch sử cách tính trùng giờ của một giáo viên (?teacherId=). */
export const GET = route(async (req, _ctx, viewer) => {
  allow(canSeePayroll(viewer), "Không có quyền xem bảng lương");
  const teacherId = new URL(req.url).searchParams.get("teacherId") ?? "";
  return listTeacherOverlapHistory(idParam(teacherId));
});

/** B4: đổi cách tính trùng giờ kèm ngày hiệu lực (chỉ Quản lý). */
export const PUT = route(async (req, _ctx, viewer) => {
  const input = await body(req, UpdateTeacherOverlapInput);
  return updateTeacherOverlapSettings(input, viewer);
});