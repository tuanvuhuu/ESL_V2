import { SaveTeacherRateInput, listTeacherRates, saveTeacherRate } from "@/server/payroll";
import { body, route } from "@/server/http";

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const teacherId = Number(sp.get("teacherId")) || undefined;
  return listTeacherRates(teacherId);
});

export const POST = route(async (req, _ctx, viewer) => {
  const input = await body(req, SaveTeacherRateInput);
  return saveTeacherRate(input, viewer);
});
