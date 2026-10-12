import { addDays, todayISO } from "@/lib/dates";
import { canArrangeMakeups, canEditCenter } from "@/lib/permissions";
import { logChange } from "@/server/audit";
import { currentActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { allow, badRequest, body, conflict, route } from "@/server/http";
import { absenceInclude, loadAbsence, makeupOptions, seatsLeft } from "@/server/makeups";
import { makeupSchema } from "@/server/validators";

/** Buổi vắng chưa bù (60 ngày gần nhất) và lịch học bù sắp tới, lọc theo trung tâm chính của học sinh. */
export const GET = route(async (req, _ctx, viewer) => {
  allow(canArrangeMakeups(viewer));
  const centerId = Number(new URL(req.url).searchParams.get("centerId")) || undefined;
  const today = todayISO();
  const studentWhere = { status: { not: "QUIT" }, ...(centerId ? { centerId } : {}) };
  const [pending, booked] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        status: { in: ["EXCUSED", "UNEXCUSED"] },
        makeupId: null,
        makeupFor: { is: null },
        session: { date: { gte: addDays(today, -60) } },
        student: studentWhere,
      },
      include: absenceInclude,
      orderBy: { session: { date: "desc" } },
      take: 300,
    }),
    prisma.makeup.findMany({
      where: { student: studentWhere, OR: [{ session: { date: { gte: today } } }, { attendance: { is: null } }] },
      include: {
        student: absenceInclude.student,
        absence: { select: { status: true, session: absenceInclude.session } },
        attendance: { select: { status: true } },
        session: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            index: true,
            room: { select: { name: true } },
            class: { select: { id: true, code: true, center: { select: { id: true, name: true, color: true } } } },
          },
        },
      },
      orderBy: { session: { date: "asc" } },
      take: 300,
    }),
  ]);
  return { pending, booked };
});

/** Xếp học bù: học sinh sẽ có trong danh sách điểm danh của buổi được chọn, kèm nhãn học bù. */
export const POST = route(async (req, _ctx, viewer) => {
  const { absenceId, sessionId } = await body(req, makeupSchema);
  return prisma.$transaction(async (tx) => {
    const a = await loadAbsence(tx, absenceId);
    allow(canEditCenter(viewer, a.student.centerId), "Chỉ xếp học bù cho học sinh trung tâm mình");
    if (a.status !== "EXCUSED" && a.status !== "UNEXCUSED") throw badRequest("Buổi này học sinh không vắng");
    if (a.makeupId) throw badRequest("Đây đã là buổi học bù");
    if (a.makeupFor) throw badRequest("Buổi vắng này đã được xếp học bù");
    const options = await makeupOptions(tx, absenceId);
    const target = options.find((o) => o.id === sessionId);
    if (!target) {
      const left = (await seatsLeft(tx, [sessionId])).get(sessionId);
      if (left !== undefined && left <= 0) throw conflict("Không thể xếp: buổi này đã đủ chỗ. Chọn buổi khác.");
      throw badRequest("Buổi đã chọn không hợp lệ để học bù (khác khóa, đã qua, đã hủy hoặc trùng giờ học của học sinh)");
    }
    const m = await tx.makeup.create({ data: { absenceId, sessionId, studentId: a.studentId, createdBy: currentActor() } });
    await logChange(tx, "Student", a.studentId, "makeup-add", {
      [`Bù buổi ${a.session.date.split("-").reverse().join("/")} · ${a.session.class.code}`]: [null, `${target.date.split("-").reverse().join("/")} ${target.startTime} · ${target.class.code}`],
    });
    return m;
  });
});

