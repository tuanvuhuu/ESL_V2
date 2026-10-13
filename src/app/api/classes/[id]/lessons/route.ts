import { assertCanViewClass } from "@/server/access";
import { prisma } from "@/server/db";
import { idParam, route, type IdCtx } from "@/server/http";
import { classLessonPlan } from "@/server/lessons";

/** E1: bài giảng và bài tập từng buổi của lớp. Giáo viên, trợ giảng chỉ xem được lớp mình. */
export const GET = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  await assertCanViewClass(viewer, id);
  return classLessonPlan(prisma, id);
});
