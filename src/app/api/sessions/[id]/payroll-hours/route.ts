import { SetSessionPayrollInput, setSessionPayrollMinutes } from "@/server/payroll";
import { body, idParam, route, type IdCtx } from "@/server/http";

/** B1: Quản lý sửa tay giờ tính lương của một buổi (bắt buộc lý do); minutes = null là bỏ sửa tay. */
export const PUT = route<IdCtx>(async (req, ctx, viewer) => {
  const { id } = await ctx.params;
  const input = await body(req, SetSessionPayrollInput);
  return setSessionPayrollMinutes(idParam(id), input, viewer);
});
