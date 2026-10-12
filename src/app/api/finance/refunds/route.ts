import { CreateRefundInput, createRefund } from "@/server/finance";
import { body, route } from "@/server/http";

export const POST = route(async (req, _ctx, viewer) => {
  const input = await body(req, CreateRefundInput);
  return createRefund(input, viewer);
});
