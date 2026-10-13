// B5: gợi ý người dạy thay có xét cấp độ dạy được của giáo viên.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getSubstitutes } from "@/app/api/sessions/[id]/substitutes/route";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

let token = "";
let sessionId = 0;
let level = "";
let teacherId = 0;
let originalLevels: string | null = null;

async function candidate() {
  const res = await getSubstitutes(
    new Request("http://localhost/x", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }),
    { params: Promise.resolve({ id: String(sessionId) }) } as never,
  );
  const list = (await res.json()) as { id: number; levelMatch: string; score: number }[];
  return list.find((c) => c.id === teacherId)!;
}

beforeAll(async () => {
  const u = await prisma.user.findUniqueOrThrow({ where: { username: "quanly" } });
  token = (await createSession(u.id)).token;
  const s = await prisma.classSession.findFirstOrThrow({
    where: { class: { course: { level: { not: null } } } },
    include: { class: { include: { course: true } } },
    orderBy: { date: "desc" },
  });
  sessionId = s.id;
  level = s.class.course!.level!;
  const t = await prisma.teacher.findFirstOrThrow({ where: { status: "ACTIVE", role: { not: "ASSISTANT" }, id: { not: s.teacherId } } });
  teacherId = t.id;
  originalLevels = t.teachableLevels;
});

afterAll(async () => {
  await prisma.teacher.update({ where: { id: teacherId }, data: { teachableLevels: originalLevels } });
  await prisma.userSession.deleteMany({ where: { user: { username: "quanly" } } });
  await prisma.$disconnect();
});

describe("B5: gợi ý dạy thay theo cấp độ", () => {
  it("chưa khai cấp độ thì không cộng không trừ", async () => {
    await prisma.teacher.update({ where: { id: teacherId }, data: { teachableLevels: null } });
    expect((await candidate()).levelMatch).toBe("UNKNOWN");
  });

  it("đúng cấp độ được cộng điểm, khác cấp độ bị trừ", async () => {
    await prisma.teacher.update({ where: { id: teacherId }, data: { teachableLevels: null } });
    const base = (await candidate()).score;
    await prisma.teacher.update({ where: { id: teacherId }, data: { teachableLevels: `Zzz, ${level}` } });
    const match = await candidate();
    expect(match.levelMatch).toBe("MATCH");
    expect(match.score).toBe(base + 3);
    await prisma.teacher.update({ where: { id: teacherId }, data: { teachableLevels: "Zzz" } });
    const miss = await candidate();
    expect(miss.levelMatch).toBe("MISMATCH");
    expect(miss.score).toBe(base - 3);
  });
});