import { assertCanViewStudent } from "@/server/access";
import { prisma } from "@/server/db";
import { learningHistory } from "@/server/history";
import { idParam, route, type IdCtx } from "@/server/http";

/** E2: lịch sử học tập của học sinh theo khóa. Giáo viên, trợ giảng chỉ xem học sinh lớp mình. */
export const GET = route<IdCtx>(async (_req, { params }, viewer) => {
  const id = idParam((await params).id);
  await assertCanViewStudent(viewer, id);
  return learningHistory(prisma, id);
});
