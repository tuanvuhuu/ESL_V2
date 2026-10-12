import { canEditTeachers, canSeeTeachers } from "@/lib/permissions";
import { normalizeQuery, formatCode } from "@/lib/text";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { allow, body, route } from "@/server/http";
import { teacherSearchText } from "@/server/search-text";
import { teacherSchema } from "@/server/validators";
import { todayISO } from "@/lib/dates";

export const GET = route(async (req, _ctx, viewer) => {
  allow(canSeeTeachers(viewer));
  const sp = new URL(req.url).searchParams;
  const q = normalizeQuery(sp.get("q") ?? "");
  const centerId = Number(sp.get("centerId")) || undefined;
  const month = todayISO().slice(0, 7);
  const teachers = await prisma.teacher.findMany({
    where: {
      ...(q ? { searchText: { contains: q } } : {}),
      ...(centerId ? { centers: { some: { centerId } } } : {}),
    },
    include: {
      centers: { include: { center: { select: { id: true, name: true, color: true } } } },
      mainClasses: { where: { status: { in: ["PLANNED", "ACTIVE"] } }, select: { id: true } },
      assistantIn: { where: { class: { status: { in: ["PLANNED", "ACTIVE"] } } }, select: { classId: true } },
      sessions: {
        where: { status: "SCHEDULED", date: { startsWith: month } },
        select: { startTime: true, endTime: true },
      },
    },
    orderBy: { id: "desc" },
  });
  return teachers.map(({ sessions, mainClasses, assistantIn, ...t }) => ({
    ...t,
    activeClassCount: mainClasses.length + assistantIn.length,
    // Giờ dạy chính trong tháng theo lịch (chưa trừ buổi chưa diễn ra; bảng giờ thực tế ở đợt sau).
    monthHours:
      sessions.reduce((sum, s) => {
        const [h1, m1] = s.startTime.split(":").map(Number);
        const [h2, m2] = s.endTime.split(":").map(Number);
        return sum + (h2 * 60 + m2 - h1 * 60 - m1);
      }, 0) / 60,
  }));
});

export const POST = route(async (req, _ctx, viewer) => {
  allow(canEditTeachers(viewer));
  const { centerIds, ...data } = await body(req, teacherSchema);
  return prisma.$transaction(async (tx) => {
    const created = await tx.teacher.create({
      data: { ...data, code: `TMP-${Date.now()}-${Math.random()}`, centers: { create: centerIds.map((centerId) => ({ centerId })) } },
    });
    const code = formatCode("GV", created.id, 4);
    const t = await tx.teacher.update({
      where: { id: created.id },
      data: { code, searchText: teacherSearchText({ ...created, code }) },
    });
    await logChange(tx, "Teacher", t.id, "create", { fullName: [null, t.fullName] });
    return t;
  });
});
