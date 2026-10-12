import { todayISO } from "@/lib/dates";
import { getRevenueReport } from "@/server/reports";
import { route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  const currentMonth = todayISO().slice(0, 7);
  const fromMonth = sp.get("fromMonth") || currentMonth;
  const toMonth = sp.get("toMonth") || currentMonth;

  return getRevenueReport({ centerId, fromMonth, toMonth, viewer });
});
