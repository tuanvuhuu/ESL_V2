import type { Prisma } from "@prisma/client";
import { findConflicts, type SlotLite } from "@/lib/schedule";
import { prisma } from "./db";
import { conflict } from "./http";

type Tx = Prisma.TransactionClient | typeof prisma;

const sessionInclude = {
  room: true,
  class: { include: { center: true, assistants: true } },
} satisfies Prisma.ClassSessionInclude;

type SessionRow = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;

export function toSlot(s: SessionRow): SlotLite {
  return {
    sessionId: s.id,
    classId: s.classId,
    classCode: s.class.code,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    roomId: s.roomId,
    roomName: s.room.name,
    centerId: s.class.centerId,
    centerName: s.class.center.name,
    staffIds: [s.teacherId, ...s.class.assistants.map((a) => a.teacherId)],
  };
}

/** Các buổi chưa hủy trong những ngày cần kiểm tra. */
export async function loadSlots(tx: Tx, dates: string[]): Promise<SlotLite[]> {
  if (dates.length === 0) return [];
  const rows = await tx.classSession.findMany({
    where: { date: { in: Array.from(new Set(dates)) }, status: { not: "CANCELLED" } },
    include: sessionInclude,
  });
  return rows.map(toSlot);
}

/** Kiểm tra trùng; có trùng thì ném lỗi 409 với thông báo đầu tiên và toàn bộ danh sách. */
export async function assertNoConflicts(tx: Tx, candidates: SlotLite[]) {
  const existing = await loadSlots(
    tx,
    candidates.map((c) => c.date),
  );
  const staffIds = Array.from(new Set(candidates.flatMap((c) => c.staffIds)));
  const staff = await tx.teacher.findMany({ where: { id: { in: staffIds } }, select: { id: true, displayName: true } });
  const names = Object.fromEntries(staff.map((t) => [t.id, t.displayName]));
  const conflicts = findConflicts(candidates, existing, names);
  if (conflicts.length > 0) {
    throw conflict(
      `Không thể lưu: ${conflicts[0].message}`,
      conflicts.map((c) => ({ kind: c.kind, date: c.date, message: c.message, classId: c.with.classId })),
    );
  }
}
