import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { addDays, todayISO } from "@/lib/dates";
import { findConflicts, generateSessionDates, overlaps, type SlotLite } from "@/lib/schedule";
import { prisma } from "./db";
import { badRequest, conflict } from "./http";
import { loadSlots } from "./slots";
import type { classSchema } from "./validators";

type Tx = Prisma.TransactionClient | typeof prisma;
export type ClassInput = z.infer<typeof classSchema>;

/** Kiểm tra phòng thuộc trung tâm, giáo viên/trợ giảng hợp lệ; trả về tên để báo lỗi. */
export async function validateRefs(tx: Tx, input: Pick<ClassInput, "centerId" | "roomId" | "teacherId" | "assistantIds">) {
  const room = await tx.room.findUnique({ where: { id: input.roomId } });
  if (!room || room.centerId !== input.centerId) throw badRequest("Phòng không thuộc trung tâm đã chọn");
  if (!room.active) throw badRequest(`Phòng ${room.name} đang tạm khóa`);
  if (input.assistantIds.includes(input.teacherId)) throw badRequest("Trợ giảng phải khác giáo viên chính");
  const ids = [input.teacherId, ...input.assistantIds];
  const staff = await tx.teacher.findMany({ where: { id: { in: ids } } });
  const byId = new Map(staff.map((s) => [s.id, s]));
  const main = byId.get(input.teacherId);
  if (!main) throw badRequest("Không tìm thấy giáo viên");
  if (main.status !== "ACTIVE") throw badRequest(`${main.displayName} không còn ở trạng thái đang làm`);
  if (main.role === "ASSISTANT") throw badRequest(`${main.displayName} là trợ giảng, không thể làm giáo viên chính`);
  for (const aid of input.assistantIds) {
    const a = byId.get(aid);
    if (!a) throw badRequest("Không tìm thấy trợ giảng");
    if (a.status !== "ACTIVE") throw badRequest(`${a.displayName} không còn ở trạng thái đang làm`);
    if (a.role === "TEACHER") throw badRequest(`${a.displayName} không có vai trò trợ giảng`);
  }
  return { room, names: Object.fromEntries(staff.map((s) => [s.id, s.displayName])) as Record<number, string> };
}

/** Sinh danh sách buổi dự kiến và các chỗ trùng (không ném lỗi), dùng cho xem trước và khi lưu. */
export async function planClass(tx: Tx, input: ClassInput) {
  const { room, names } = await validateRefs(tx, input);
  const center = await tx.center.findUniqueOrThrow({ where: { id: input.centerId } });
  const holidays = await tx.holiday.findMany({ where: { date: { gte: input.startDate } } });
  const { dates, skipped } = generateSessionDates({
    startDate: input.startDate,
    weekdays: input.weekdays,
    totalSessions: input.totalSessions,
    centerId: input.centerId,
    holidays,
  });
  const staffIds = [input.teacherId, ...input.assistantIds];
  const candidates: SlotLite[] = dates.map((date) => ({
    date,
    startTime: input.startTime,
    endTime: input.endTime,
    roomId: input.roomId,
    roomName: room.name,
    centerId: input.centerId,
    centerName: center.name,
    staffIds,
  }));
  const existing = await loadSlots(tx, dates);
  const conflicts = findConflicts(candidates, existing, names);
  const warnings: string[] = [];
  if (input.maxStudents > room.capacity) {
    warnings.push(`Sĩ số tối đa ${input.maxStudents} lớn hơn sức chứa phòng ${room.name} (${room.capacity}).`);
  }
  return {
    dates,
    skipped,
    endDate: dates[dates.length - 1] ?? null,
    conflicts: conflicts.map((c) => ({ kind: c.kind, date: c.date, message: c.message, classId: c.with.classId })),
    warnings,
  };
}

/** Ngày học kế tiếp sau `after`, theo thứ lặp của lớp và bỏ ngày lễ. */
export async function nextSessionDate(tx: Tx, cls: { weekdays: string; centerId: number }, after: string) {
  const holidays = await tx.holiday.findMany({ where: { date: { gt: after } } });
  const { dates } = generateSessionDates({
    startDate: addDays(after, 1),
    weekdays: cls.weekdays.split(",").map(Number),
    totalSessions: 1,
    centerId: cls.centerId,
    holidays,
  });
  if (!dates[0]) throw badRequest("Không tìm được ngày học tiếp theo");
  return dates[0];
}

/** Chặn học sinh học 2 lớp trùng giờ (mặc định đề xuất, mục 5). */
export async function assertStudentFree(tx: Tx, studentId: number, classId: number) {
  const today = todayISO();
  const others = await tx.classEnrollment.findMany({
    where: { studentId, leftAt: null, classId: { not: classId } },
    select: { classId: true },
  });
  if (others.length === 0) return;
  const [mine, theirs] = await Promise.all([
    tx.classSession.findMany({ where: { classId, date: { gte: today }, status: "SCHEDULED" } }),
    tx.classSession.findMany({
      where: { classId: { in: others.map((o) => o.classId) }, date: { gte: today }, status: "SCHEDULED" },
      include: { class: { select: { code: true } } },
    }),
  ]);
  for (const a of mine) {
    const hit = theirs.find((b) => b.date === a.date && overlaps(a.startTime, a.endTime, b.startTime, b.endTime));
    if (hit) {
      throw conflict(
        `Không thể xếp lớp: học sinh đang học lớp ${hit.class.code} lúc ${hit.startTime}–${hit.endTime} ngày ${hit.date.split("-").reverse().join("/")}. Chọn lớp khác.`,
      );
    }
  }
}
