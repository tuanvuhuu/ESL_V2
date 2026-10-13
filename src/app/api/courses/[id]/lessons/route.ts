import { parseMaterials } from "@/lib/curriculum";
import { canManageSettings } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { prisma } from "@/server/db";
import { allow, body, idParam, notFound, route, type IdCtx } from "@/server/http";
import { lessonsSchema } from "@/server/validators";

const toDto = <L extends { materials: string }>(l: L) => ({ ...l, materials: parseMaterials(l.materials) });

/** Khung chương trình của khóa: ai đăng nhập cũng xem được (giáo viên cần biết hôm nay dạy gì). */
export const GET = route<IdCtx>(async (_req, { params }) => {
  const id = idParam((await params).id);
  const course = await prisma.course.findUnique({ where: { id }, include: { lessons: { orderBy: { index: "asc" } } } });
  if (!course) throw notFound("Không tìm thấy khóa học");
  return { course: { ...course, lessons: undefined }, lessons: course.lessons.map(toDto) };
});

/** Lưu cả khung chương trình: bài không còn trong danh sách bị xóa. Chỉ quản lý. */
export const PUT = route<IdCtx>(async (req, { params }, viewer) => {
  allow(canManageSettings(viewer));
  const id = idParam((await params).id);
  const { lessons } = await body(req, lessonsSchema);
  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({ where: { id }, select: { id: true, _count: { select: { lessons: true } } } });
    if (!course) throw notFound("Không tìm thấy khóa học");
    await tx.courseLesson.deleteMany({ where: { courseId: id, index: { notIn: lessons.map((l) => l.index) } } });
    for (const l of lessons) {
      const data = {
        title: l.title,
        objectives: l.objectives,
        content: l.content,
        homework: l.homework,
        materials: JSON.stringify(l.materials.map((m) => ({ name: m.name || m.url, url: m.url }))),
        testKind: l.testKind ?? null,
      };
      await tx.courseLesson.upsert({
        where: { courseId_index: { courseId: id, index: l.index } },
        create: { courseId: id, index: l.index, ...data },
        update: data,
      });
    }
    await logChange(tx, "Course", id, "curriculum", { lessons: [course._count.lessons, lessons.length] });
    const saved = await tx.courseLesson.findMany({ where: { courseId: id }, orderBy: { index: "asc" } });
    return saved.map(toDto);
  });
});
