import { canSeeContacts } from "@/lib/permissions";
import { contactInclude } from "@/server/contacts";
import { prisma } from "@/server/db";
import { allow, route } from "@/server/http";

/** Việc cần gọi lại (M7): các lần liên lạc có hẹn ngày gọi lại chưa xử lý, sớm nhất trước. */
export const GET = route(async (req, _ctx, viewer) => {
  allow(canSeeContacts(viewer));
  const centerId = Number(new URL(req.url).searchParams.get("centerId")) || undefined;
  return prisma.contactLog.findMany({
    where: { followUpDate: { not: null }, followUpDoneAt: null, ...(centerId ? { student: { centerId } } : {}) },
    include: contactInclude,
    orderBy: [{ followUpDate: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
});
