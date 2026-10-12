import { lockPayrollPeriod } from "@/server/payroll";
import { idParam, route, type IdCtx } from "@/server/http";

export const POST = route<IdCtx>(async (_req, ctx, viewer) => {
  const { id } = await ctx.params;
  const periodId = idParam(id);
  return lockPayrollPeriod(periodId, viewer);
});
