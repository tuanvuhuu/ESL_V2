import { todayISO } from "@/lib/dates";
import { generateOrGetMonthlyPayroll } from "@/server/payroll";
import { route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  const sp = new URL(req.url).searchParams;
  const month = sp.get("month") || todayISO().slice(0, 7);
  const centerId = Number(sp.get("centerId")) || undefined;
  const teacherId = Number(sp.get("teacherId")) || undefined;

  return generateOrGetMonthlyPayroll({ month, centerId, teacherId, viewer });
});
