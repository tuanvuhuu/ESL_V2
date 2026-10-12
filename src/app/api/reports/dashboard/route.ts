import { getTodayDashboard } from "@/server/reports";
import { route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  return getTodayDashboard({ centerId, viewer });
});
