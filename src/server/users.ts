import type { Prisma } from "@prisma/client";

/** Thông tin tài khoản trả về giao diện (không kèm mật khẩu). */
export const userSelect = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  centerId: true,
  teacherId: true,
  active: true,
  lastLoginAt: true,
  center: { select: { id: true, name: true, color: true } },
  teacher: { select: { id: true, displayName: true, code: true } },
} satisfies Prisma.UserSelect;
