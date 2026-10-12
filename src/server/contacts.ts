import type { Prisma } from "@prisma/client";

/** Dữ liệu kèm theo mỗi dòng nhật ký liên lạc. */
export const contactInclude = {
  student: { select: { id: true, code: true, fullName: true, centerId: true, center: { select: { name: true, color: true } } } },
  parent: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.ContactLogInclude;
