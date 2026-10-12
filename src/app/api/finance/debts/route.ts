import type { DebtStatus } from "@/lib/finance";
import { canSeeFinance } from "@/lib/permissions";
import { getStudentDebts } from "@/server/finance";
import { allow, route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  allow(canSeeFinance(viewer), "Không có quyền xem công nợ");
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  const search = sp.get("search") || undefined;
  const status = (sp.get("status") as DebtStatus) || undefined;
  const today = sp.get("today") || undefined;

  return getStudentDebts({ centerId, search, status, today });
});
