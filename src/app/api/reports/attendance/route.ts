import { getAttendanceReport } from "@/server/reports";
import { route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  const classId = Number(sp.get("classId")) || undefined;
  const fromDate = sp.get("fromDate") || undefined;
  const toDate = sp.get("toDate") || undefined;

  return getAttendanceReport({ centerId, classId, fromDate, toDate, viewer });
});
