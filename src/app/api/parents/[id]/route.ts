import { canSeeParents } from "@/lib/permissions";
import { assertCanEditParent } from "@/server/access";
import { diff, logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { allow, body, conflict, idParam, notFound, route, type IdCtx } from "@/server/http";
import { refreshParentSearch } from "@/server/search-text";
import { parentSchema } from "@/server/validators";

export const GET = route<IdCtx>(async (_req, { params }, viewer) => {
  allow(canSeeParents(viewer));
  const id = idParam((await params).id);
  const p = await prisma.parent.findUnique({
    where: { id },
    include: {
      children: {
        include: {
          student: {
            include: {
              center: { select: { name: true, color: true } },
              enrollments: {
                where: { leftAt: null },
                include: { class: { select: { id: true, code: true, name: true, weekdays: true, startTime: true, endTime: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!p) throw notFound("Không tìm thấy phụ huynh");
  return p;
});

export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  const id = idParam((await params).id);
  await assertCanEditParent(prisma, viewer, id);
  const data = await body(req, parentSchema);
  const dup = await prisma.parent.findUnique({ where: { phone: data.phone } });
  if (dup && dup.id !== id) throw conflict(`SĐT này đã thuộc phụ huynh ${dup.fullName}`);
  return prisma.$transaction(async (tx) => {
    const before = await tx.parent.findUnique({ where: { id } });
    if (!before) throw notFound("Không tìm thấy phụ huynh");
    const after = await tx.parent.update({ where: { id }, data });
    await refreshParentSearch(tx, id);
    await logChange(tx, "Parent", id, "update", diff(before, after, Object.keys(data)));
    return after;
  });
});
