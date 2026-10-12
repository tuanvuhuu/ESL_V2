import { todayISO } from "@/lib/dates";
import { canSeePayroll, isStaff } from "@/lib/permissions";
import { getTeacherMonthlyDetails } from "@/server/payroll";
import { allow, notFound, route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  const sp = new URL(req.url).searchParams;
  const month = sp.get("month") || todayISO().slice(0, 7);

  let teacherId = viewer.teacherId;
  const requestedTeacherId = Number(sp.get("teacherId"));
  if (requestedTeacherId && canSeePayroll(viewer)) {
    teacherId = requestedTeacherId;
  }

  allow(teacherId != null, "Không xác định được hồ sơ giáo viên");
  return getTeacherMonthlyDetails(teacherId, month);
});
