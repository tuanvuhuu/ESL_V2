import type { Prisma } from "@prisma/client";
import { formatCode, normalizeVi } from "@/lib/text";
import { logChange } from "@/server/audit";
import { planClass } from "@/server/classes";
import { prisma } from "@/server/db";
import { body, conflict, route } from "@/server/http";
import { classSchema } from "@/server/validators";

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  const status = sp.get("status") || undefined;
  const q = normalizeVi(sp.get("q"));
  const where: Prisma.ClassGroupWhereInput = {
    ...(centerId ? { centerId } : {}),
    ...(status ? { status } : {}),
  };
  const rows = await prisma.classGroup.findMany({
    where,
    include: {
      center: { select: { id: true, name: true, color: true } },
      room: { select: { name: true, capacity: true } },
      course: { select: { name: true } },
      teacher: { select: { id: true, displayName: true } },
      assistants: { include: { teacher: { select: { id: true, displayName: true } } } },
      _count: { select: { enrollments: { where: { leftAt: null } } } },
      sessions: { where: { status: "SCHEDULED" }, select: { date: true }, orderBy: { date: "asc" } },
    },
    orderBy: { id: "desc" },
  });
  const filtered = q
    ? rows.filter((r) => normalizeVi(`${r.code} ${r.name} ${r.teacher.displayName}`).includes(q))
    : rows;
  return filtered.map(({ sessions, ...r }) => ({
    ...r,
    sessionCount: sessions.length,
    endDate: sessions[sessions.length - 1]?.date ?? null,
  }));
});

export const POST = route(async (req) => {
  const input = await body(req, classSchema);
  return prisma.$transaction(async (tx) => {
    const plan = await planClass(tx, input);
    if (plan.conflicts.length > 0) {
      throw conflict(`Không thể lưu: ${plan.conflicts[0].message}`, plan.conflicts);
    }
    const center = await tx.center.findUniqueOrThrow({ where: { id: input.centerId } });
    const { assistantIds, weekdays, ...rest } = input;
    const created = await tx.classGroup.create({
      data: {
        ...rest,
        code: `TMP-${Date.now()}-${Math.random()}`,
        weekdays: [...weekdays].sort().join(","),
        assistants: { create: assistantIds.map((teacherId) => ({ teacherId })) },
        sessions: {
          create: plan.dates.map((date, i) => ({
            index: i + 1,
            date,
            startTime: input.startTime,
            endTime: input.endTime,
            roomId: input.roomId,
            teacherId: input.teacherId,
          })),
        },
      },
    });
    const cls = await tx.classGroup.update({
      where: { id: created.id },
      data: { code: `${center.code}${formatCode("L", created.id, 4)}` },
    });
    await logChange(tx, "Class", cls.id, "create", { name: [null, cls.name], sessions: [null, plan.dates.length] });
    return cls;
  });
});
