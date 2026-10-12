import { todayISO } from "@/lib/dates";
import { getTeacherReport } from "@/server/reports";
import { route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  const month = sp.get("month") || todayISO().slice(0, 7);

  return getTeacherReport({ centerId, month, viewer });
});
