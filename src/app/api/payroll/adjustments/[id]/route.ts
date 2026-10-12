import { deletePayrollAdjustment } from "@/server/payroll";
import { idParam, route, type IdCtx } from "@/server/http";

export const DELETE = route<IdCtx>(async (_req, ctx, viewer) => {
  const { id } = await ctx.params;
  const adjId = idParam(id);
  return deletePayrollAdjustment(adjId, viewer);
});
