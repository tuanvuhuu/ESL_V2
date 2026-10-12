import { z } from "zod";
import { addPayrollAdjustment } from "@/server/payroll";
import { body, idParam, route, type IdCtx } from "@/server/http";

const AdjustmentPayload = z.object({
  type: z.enum(["BONUS", "ALLOWANCE", "PENALTY"]),
  amount: z.number().int().positive("Số tiền phải lớn hơn 0"),
  note: z.string().trim().min(2, "Vui lòng nhập lý do"),
});

export const POST = route<IdCtx>(async (req, ctx, viewer) => {
  const { id } = await ctx.params;
  const payrollPeriodId = idParam(id);
  const input = await body(req, AdjustmentPayload);
  return addPayrollAdjustment({ ...input, payrollPeriodId }, viewer);
});
