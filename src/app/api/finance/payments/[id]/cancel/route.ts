import { z } from "zod";
import { cancelPayment } from "@/server/finance";
import { body, idParam, route, type IdCtx } from "@/server/http";

const CancelPaymentInput = z.object({
  reason: z.string().trim().min(3, "Vui lòng nhập lý do hủy phiếu thu"),
});

export const POST = route<IdCtx>(async (req, ctx, viewer) => {
  const { id } = await ctx.params;
  const paymentId = idParam(id);
  const input = await body(req, CancelPaymentInput);
  return cancelPayment(paymentId, input.reason, viewer);
});
