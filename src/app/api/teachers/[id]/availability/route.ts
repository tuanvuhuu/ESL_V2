import { WEEKDAYS } from "@/lib/constants";
import { normalizeSlots } from "@/lib/availability";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { badRequest, body, idParam, route, type IdCtx } from "@/server/http";
import { assertCanManageTime, loadTeacherForTime } from "@/server/staffing";
import { availabilitySchema } from "@/server/validators";

const slotText = (s: { weekday: number; startTime: string; endTime: string }) =>
  `${WEEKDAYS.find((w) => w.value === s.weekday)?.short} ${s.startTime}–${s.endTime}`;

export const GET = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  await loadTeacherForTime(prisma, viewer, id);
  return prisma.teacherAvailability.findMany({ where: { teacherId: id }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
});

/** Thay toàn bộ lịch rảnh; khung trùng hoặc nối tiếp nhau được gộp lại. */
export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const { slots } = await body(req, availabilitySchema);
  return prisma.$transaction(async (tx) => {
    const t = await loadTeacherForTime(tx, viewer, id);
    assertCanManageTime(viewer, t);
    const centerIds = new Set(t.centers.map((c) => c.centerId));
    if (slots.some((s) => s.centerId != null && !centerIds.has(s.centerId))) throw badRequest(`${t.displayName} không dạy ở trung tâm đã chọn`);
    const before = await tx.teacherAvailability.findMany({ where: { teacherId: id }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
    const next = normalizeSlots(slots.map((s) => ({ ...s, centerId: s.centerId ?? null })));
    await tx.teacherAvailability.deleteMany({ where: { teacherId: id } });
    await tx.teacherAvailability.createMany({ data: next.map((s) => ({ ...s, teacherId: id })) });
    await logChange(tx, "Teacher", id, "availability", { slots: [before.map(slotText), next.map(slotText)] });
    return tx.teacherAvailability.findMany({ where: { teacherId: id }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
  });
});
