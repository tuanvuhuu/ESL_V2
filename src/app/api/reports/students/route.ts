import { todayISO } from "@/lib/dates";
import { getStudentReport } from "@/server/reports";
import { route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  const raw = sp.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : todayISO().slice(0, 7);
  return getStudentReport({ centerId, month, viewer });
});
