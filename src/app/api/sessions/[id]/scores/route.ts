import { computeTotal, SKILLS, testKindOption } from "@/lib/curriculum";
import { todayISO } from "@/lib/dates";
import { assertCanTakeAttendance, loadSession, rosterFor } from "@/server/attendance";
import { logChange } from "@/server/audit";
import { currentActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { badRequest, body, idParam, route, type IdCtx } from "@/server/http";
import { scoresSchema } from "@/server/validators";

const fmt = (v: number | null | undefined) => (v == null ? null : String(v));

/** Lưu điểm kiểm tra theo kỹ năng cả buổi. Quyền như điểm danh; mỗi thay đổi ghi vào lịch sử học sinh. */
export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  const input = await body(req, scoresSchema);
  return prisma.$transaction(async (tx) => {
    const s = await loadSession(tx, id);
    assertCanTakeAttendance(viewer, s);
    if (s.status === "CANCELLED") throw badRequest("Buổi này đã hủy, không nhập điểm được");
    if (s.date > todayISO()) throw badRequest("Chưa đến ngày kiểm tra, chưa nhập điểm được");
    const roster = new Map((await rosterFor(tx, s)).map((r) => [r.studentId, r]));
    const existing = new Map((await tx.testScore.findMany({ where: { sessionId: id } })).map((x) => [x.studentId, x]));
    const actor = currentActor();
    const where = `${testKindOption(input.kind)?.label ?? "Kiểm tra"} ${s.date.split("-").reverse().join("/")} · ${s.class.code}`;
    let saved = 0;
    for (const item of input.items) {
      const r = roster.get(item.studentId);
      if (!r) throw badRequest("Có học sinh không thuộc buổi học này, tải lại trang rồi nhập lại");
      const skills = Object.fromEntries(SKILLS.map((k) => [k.key, item[k.key] ?? null])) as Record<(typeof SKILLS)[number]["key"], number | null>;
      const total = computeTotal(skills, item.total);
      const before = existing.get(item.studentId);
      if (total == null) {
        if (before) {
          await tx.testScore.delete({ where: { id: before.id } });
          await logChange(tx, "Student", item.studentId, "score", { [where]: [fmt(before.total), null] });
        }
        continue;
      }
      const data = { kind: input.kind, ...skills, total, note: item.note, enteredBy: actor };
      const same =
        before &&
        before.kind === data.kind &&
        before.total === total &&
        before.note === data.note &&
        SKILLS.every((k) => before[k.key] === skills[k.key]);
      if (same) continue;
      await tx.testScore.upsert({
        where: { sessionId_studentId: { sessionId: id, studentId: item.studentId } },
        create: { sessionId: id, studentId: item.studentId, enrollmentId: r.enrollmentId, ...data },
        update: data,
      });
      await logChange(tx, "Student", item.studentId, "score", { [where]: [fmt(before?.total), fmt(total)] });
      saved++;
    }
    return { ok: true, saved };
  });
});
