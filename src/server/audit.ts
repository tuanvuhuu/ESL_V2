import type { Prisma } from "@prisma/client";
import { currentActor } from "./auth";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

/** So sánh hai bản ghi, chỉ giữ các trường có thay đổi. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>, fields?: string[]) {
  const keys = fields ?? Object.keys(after);
  const changes: Record<string, [unknown, unknown]> = {};
  for (const k of keys) {
    const a = before[k] ?? null;
    const b = after[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[k] = [a, b];
  }
  return changes;
}

export async function logChange(
  tx: Tx,
  entity: string,
  entityId: number,
  action: string,
  changes: Record<string, unknown> = {},
) {
  if (action === "update" && Object.keys(changes).length === 0) return;
  await tx.auditLog.create({ data: { entity, entityId, action, changes: JSON.stringify(changes), actor: currentActor() } });
}
