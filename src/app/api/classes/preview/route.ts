import { canEditCenter } from "@/lib/permissions";
import { planClass } from "@/server/classes";
import { prisma } from "@/server/db";
import { allow, body, route } from "@/server/http";
import { classSchema } from "@/server/validators";

export const POST = route(async (req, _ctx, viewer) => {
  const input = await body(req, classSchema);
  allow(canEditCenter(viewer, input.centerId), "Chỉ mở được lớp ở trung tâm mình");
  return planClass(prisma, input);
});
