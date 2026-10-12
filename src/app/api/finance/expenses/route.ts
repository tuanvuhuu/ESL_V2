import { canSeeFinance } from "@/lib/permissions";
import { CreateExpenseInput, createExpense, listExpenses } from "@/server/finance";
import { allow, body, route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  allow(canSeeFinance(viewer), "Không có quyền xem chi phí");
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  const category = sp.get("category") || undefined;
  const fromDate = sp.get("fromDate") || undefined;
  const toDate = sp.get("toDate") || undefined;

  return listExpenses({ centerId, category, fromDate, toDate });
});

export const POST = route(async (req, _ctx, viewer) => {
  const input = await body(req, CreateExpenseInput);
  return createExpense(input, viewer);
});
