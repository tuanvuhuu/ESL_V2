import { canArrangeMakeups } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { allow, idParam, route } from "@/server/http";
import { makeupOptions } from "@/server/makeups";

/** Gợi ý buổi học bù cho một buổi vắng. */
export const GET = route(async (req, _ctx, viewer) => {
  allow(canArrangeMakeups(viewer));
  const absenceId = idParam(new URL(req.url).searchParams.get("absenceId") ?? "");
  return makeupOptions(prisma, absenceId);
});
