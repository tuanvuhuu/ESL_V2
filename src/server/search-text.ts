import type { Prisma } from "@prisma/client";
import { buildSearchText } from "@/lib/text";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function refreshStudentSearch(tx: Tx, studentId: number) {
  const s = await tx.student.findUnique({
    where: { id: studentId },
    include: { guardians: { include: { parent: true } } },
  });
  if (!s) return;
  const searchText = buildSearchText([
    s.code,
    s.fullName,
    s.englishName,
    ...s.guardians.flatMap((g) => [g.parent.fullName, g.parent.phone]),
  ]);
  await tx.student.update({ where: { id: studentId }, data: { searchText } });
}

export async function refreshParentSearch(tx: Tx, parentId: number) {
  const p = await tx.parent.findUnique({
    where: { id: parentId },
    include: { children: { include: { student: true } } },
  });
  if (!p) return;
  const searchText = buildSearchText([
    p.fullName,
    p.phone,
    p.zalo,
    ...p.children.flatMap((c) => [c.student.fullName, c.student.englishName]),
  ]);
  await tx.parent.update({ where: { id: parentId }, data: { searchText } });
  for (const c of p.children) await refreshStudentSearch(tx, c.studentId);
}

export function teacherSearchText(t: { code: string; fullName: string; displayName: string; phone?: string | null }) {
  return buildSearchText([t.code, t.fullName, t.displayName, t.phone]);
}
