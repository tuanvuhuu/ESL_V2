import { canManageSettings } from "@/lib/permissions";
import { diff, logChange } from "@/server/audit";
import { hashPassword } from "@/server/auth";
import { prisma } from "@/server/db";
import { allow, badRequest, body, conflict, idParam, notFound, route, type IdCtx } from "@/server/http";
import { userUpdateSchema } from "@/server/validators";
import { userSelect } from "@/server/users";

/** Sửa tài khoản: vai trò, trung tâm, khóa / mở, đặt lại mật khẩu. */
export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  allow(canManageSettings(viewer));
  const id = idParam((await params).id);
  const { password, ...data } = await body(req, userUpdateSchema);
  if (id === viewer.id && (data.role !== "MANAGER" || !data.active))
    throw badRequest("Không thể tự khóa hoặc bỏ quyền quản lý của chính mình");
  if (data.teacherId) {
    const taken = await prisma.user.findUnique({ where: { teacherId: data.teacherId } });
    if (taken && taken.id !== id) throw conflict("Giáo viên này đã có tài khoản");
  }
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id } });
    if (!before) throw notFound("Không tìm thấy tài khoản");
    const after = await tx.user.update({
      where: { id },
      data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
    });
    // Đổi quyền, khóa hoặc đặt lại mật khẩu thì đăng xuất mọi thiết bị của người đó.
    const changes = diff(before, after, Object.keys(data));
    if (password || Object.keys(changes).length > 0) await tx.userSession.deleteMany({ where: { userId: id } });
    await logChange(tx, "User", id, "update", { ...changes, ...(password ? { password: ["", "đặt lại"] } : {}) });
    return tx.user.findUniqueOrThrow({ where: { id }, select: userSelect });
  });
});
