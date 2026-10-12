import { deleteExpense } from "@/server/finance";
import { idParam, route, type IdCtx } from "@/server/http";

export const DELETE = route<IdCtx>(async (_req, ctx, viewer) => {
  const { id } = await ctx.params;
  const expenseId = idParam(id);
  return deleteExpense(expenseId, viewer);
});
