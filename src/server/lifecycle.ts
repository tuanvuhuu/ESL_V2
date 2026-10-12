// Việc hệ thống tự làm khi có người mở danh sách: đổi trạng thái lớp theo lịch.
import type { Prisma } from "@prisma/client";
import { todayISO } from "@/lib/dates";
import { autoClassStatus } from "@/lib/schedule";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Lớp đã qua buổi cuối thành "Đã kết thúc", lớp dự kiến đã tới buổi đầu thành "Đang học". Ghi nhật ký tên "Hệ thống". */
export async function syncClassStatuses(tx: Tx = prisma) {
  const today = todayISO();
  const classes = await tx.classGroup.findMany({
    where: { status: { in: ["PLANNED", "ACTIVE"] } },
    select: { id: true, status: true, sessions: { where: { status: "SCHEDULED" }, select: { date: true }, orderBy: { date: "asc" } } },
  });
  for (const c of classes) {
    const next = autoClassStatus(c.status, c.sessions[0]?.date ?? null, c.sessions[c.sessions.length - 1]?.date ?? null, today);
    if (next === c.status) continue;
    // Chỉ đổi nếu chưa ai đổi trước (hai người mở cùng lúc).
    const { count } = await tx.classGroup.updateMany({ where: { id: c.id, status: c.status }, data: { status: next } });
    if (count) {
      await tx.auditLog.create({
        data: { entity: "Class", entityId: c.id, action: "update", changes: JSON.stringify({ status: [c.status, next] }), actor: "Hệ thống" },
      });
    }
  }
}
