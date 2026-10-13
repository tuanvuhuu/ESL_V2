import { SetSessionAssistantsInput, getSessionAssistants, setSessionAssistants } from "@/server/payroll";
import { body, idParam, route, type IdCtx } from "@/server/http";

/** B2: trợ giảng đang áp dụng cho buổi (riêng của buổi hoặc của cả lớp). */
export const GET = route<IdCtx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  return getSessionAssistants(idParam(id));
});

/** B2: đặt trợ giảng riêng cho buổi kèm số phút có mặt; danh sách rỗng = quay về trợ giảng cả lớp. */
export const PUT = route<IdCtx>(async (req, ctx, viewer) => {
  const { id } = await ctx.params;
  const input = await body(req, SetSessionAssistantsInput);
  return setSessionAssistants(idParam(id), input, viewer);
});
