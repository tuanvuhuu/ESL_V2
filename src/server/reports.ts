import { addDays, todayISO } from "@/lib/dates";
import { computeRetention, daysBetween, monthRange, percent, roomUsage } from "@/lib/reports";
import { canSeeReports, type Viewer } from "@/lib/permissions";
import { prisma } from "./db";
import { allow } from "./http";
import { payrollCostByCenter } from "./payroll";

/** Báo cáo Tổng quan hôm nay (Dashboard) */
export async function getTodayDashboard(params: { centerId?: number; viewer: Viewer }) {
  const { centerId, viewer } = params;
  allow(canSeeReports(viewer), "Không có quyền xem báo cáo");

  const today = todayISO();

  // 1. Các buổi học trong ngày
  const sessions = await prisma.classSession.findMany({
    where: {
      date: today,
      class: centerId ? { centerId } : undefined,
    },
    include: {
      class: { select: { id: true, name: true, code: true, center: true } },
      room: { select: { name: true } },
      teacher: { select: { fullName: true, displayName: true } },
      attendances: true,
    },
    orderBy: { startTime: "asc" },
  });

  const totalSessions = sessions.length;
  const cancelledSessions = sessions.filter((s) => s.status === "CANCELLED").length;
  const takenSessions = sessions.filter((s) => s.attendanceTakenAt != null).length;

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  for (const s of sessions) {
    for (const a of s.attendances) {
      if (a.status === "PRESENT") presentCount++;
      else if (a.status === "LATE") lateCount++;
      else if (a.status === "EXCUSED" || a.status === "UNEXCUSED") absentCount++;
    }
  }

  // 2. Tiền thu trong ngày
  const paymentsToday = await prisma.payment.findMany({
    where: {
      date: today,
      status: "VALID",
      ...(centerId ? { centerId } : {}),
    },
  });
  const revenueToday = paymentsToday.reduce((sum, p) => sum + p.amount, 0);

  // 3. Học sinh theo trạng thái
  const studentsCount = await prisma.student.groupBy({
    by: ["status"],
    where: centerId ? { centerId } : undefined,
    _count: true,
  });

  return {
    today,
    sessionsCount: totalSessions,
    cancelledSessions,
    takenSessions,
    attendance: {
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      total: presentCount + lateCount + absentCount,
    },
    revenueToday,
    sessionsList: sessions.map((s) => ({
      id: s.id,
      className: s.class.name,
      classCode: s.class.code,
      centerName: s.class.center.name,
      centerColor: s.class.center.color,
      roomName: s.room.name,
      teacherName: s.teacher.displayName || s.teacher.fullName,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      attendanceTaken: s.attendanceTakenAt != null,
      attendees: s.attendances.length,
    })),
    studentStatusSummary: studentsCount.map((s) => ({ status: s.status, count: s._count })),
  };
}

/** Báo cáo Doanh thu & Công nợ theo tháng hoặc khoảng thời gian */
export async function getRevenueReport(params: {
  centerId?: number;
  fromMonth: string; // YYYY-MM
  toMonth: string; // YYYY-MM
  viewer: Viewer;
}) {
  const { centerId, fromMonth, toMonth, viewer } = params;
  allow(canSeeReports(viewer), "Không có quyền xem báo cáo");

  const centers = await prisma.center.findMany({
    where: centerId ? { id: centerId } : undefined,
    select: { id: true, name: true, code: true, color: true },
  });

  const fromDate = `${fromMonth}-01`;
  const toDate = `${toMonth}-31`;

  // Các phiếu thu hợp lệ
  const payments = await prisma.payment.findMany({
    where: {
      status: "VALID",
      date: { gte: fromDate, lte: toDate },
      ...(centerId ? { centerId } : {}),
    },
    include: { enrollment: { select: { class: { select: { centerId: true } } } } },
  });

  // Các phiếu hoàn tiền
  const refunds = await prisma.refund.findMany({
    where: {
      status: "VALID",
      date: { gte: fromDate, lte: toDate },
      ...(centerId ? { centerId } : {}),
    },
    include: { enrollment: { select: { class: { select: { centerId: true } } } } },
  });

  // Gom theo trung tâm
  const byCenter = centers.map((c) => {
    const centerPayments = payments.filter((p) => p.centerId === c.id);
    const centerRefunds = refunds.filter((r) => r.centerId === c.id);

    const paidTotal = centerPayments.reduce((s, p) => s + p.amount, 0);
    const refundTotal = centerRefunds.reduce((s, r) => s + r.amount, 0);
    const netRevenue = paidTotal - refundTotal;

    const cashPaid = centerPayments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0);
    const transferPaid = centerPayments.filter((p) => p.method === "TRANSFER").reduce((s, p) => s + p.amount, 0);

    return {
      center: c,
      paidTotal,
      refundTotal,
      netRevenue,
      cashPaid,
      transferPaid,
      paymentCount: centerPayments.length,
      refundCount: centerRefunds.length,
    };
  });

  // B7: doanh thu theo ngày thu (gộp các trung tâm đang xem).
  const dayMap = new Map<string, { date: string; paid: number; refund: number; paymentCount: number }>();
  const dayRow = (date: string) => {
    let r = dayMap.get(date);
    if (!r) dayMap.set(date, (r = { date, paid: 0, refund: 0, paymentCount: 0 }));
    return r;
  };
  for (const p of payments) {
    const r = dayRow(p.date);
    r.paid += p.amount;
    r.paymentCount += 1;
  }
  for (const r of refunds) dayRow(r.date).refund += r.amount;
  const byDay = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ ...r, net: r.paid - r.refund }));

  // B7: doanh thu theo trung tâm HỌC (trung tâm của lớp học sinh đang học), khác với trung tâm THU tiền ở `byCenter`.
  const allCenters = await prisma.center.findMany({ select: { id: true, name: true, code: true, color: true } });
  const byLearningCenter = allCenters
    .map((c) => {
      const ps = payments.filter((p) => p.enrollment.class.centerId === c.id);
      const rs = refunds.filter((r) => r.enrollment.class.centerId === c.id);
      const paid = ps.reduce((s, p) => s + p.amount, 0);
      const refund = rs.reduce((s, r) => s + r.amount, 0);
      return { center: c, paidTotal: paid, refundTotal: refund, netRevenue: paid - refund, paymentCount: ps.length };
    })
    .filter((c) => c.paymentCount > 0 || c.refundTotal > 0);

  const totalPaid = byCenter.reduce((s, c) => s + c.paidTotal, 0);
  const totalRefund = byCenter.reduce((s, c) => s + c.refundTotal, 0);
  const totalNet = totalPaid - totalRefund;

  return {
    fromMonth,
    toMonth,
    summary: { totalPaid, totalRefund, totalNet },
    byCenter,
    byDay,
    byLearningCenter,
  };
}

/** Báo cáo Lãi / Lỗ đơn giản: Thực thu − Hoàn tiền − Lương giáo viên − Chi phí = Lãi/Lỗ */
export async function getProfitLossReport(params: {
  centerId?: number;
  month: string; // YYYY-MM
  viewer: Viewer;
}) {
  const { centerId, month, viewer } = params;
  allow(canSeeReports(viewer), "Không có quyền xem báo cáo");

  const centers = await prisma.center.findMany({
    where: centerId ? { id: centerId } : undefined,
    select: { id: true, name: true, code: true, color: true },
  });

  const fromDate = `${month}-01`;
  const toDate = `${month}-31`;

  // 1. Doanh thu thu tiền
  const payments = await prisma.payment.findMany({
    where: {
      status: "VALID",
      date: { gte: fromDate, lte: toDate },
      ...(centerId ? { centerId } : {}),
    },
  });

  // 2. Hoàn tiền
  const refunds = await prisma.refund.findMany({
    where: {
      status: "VALID",
      date: { gte: fromDate, lte: toDate },
      ...(centerId ? { centerId } : {}),
    },
  });

  // 3. Chi phí hoạt động
  const expenses = await prisma.expense.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      ...(centerId ? { centerId } : {}),
    },
  });

  // 4. Lương giáo viên theo trung tâm nơi buổi dạy diễn ra (B3)
  const payrollByCenter = await payrollCostByCenter(month);

  const byCenter = centers.map((c) => {
    const cPayments = payments.filter((p) => p.centerId === c.id);
    const cRefunds = refunds.filter((r) => r.centerId === c.id);
    const cExpenses = expenses.filter((e) => e.centerId === c.id);

    const revenue = cPayments.reduce((s, p) => s + p.amount, 0);
    const refund = cRefunds.reduce((s, r) => s + r.amount, 0);
    const netRevenue = revenue - refund;

    const expenseTotal = cExpenses.reduce((s, e) => s + e.amount, 0);

    // Lương giáo viên tính vào trung tâm này = lương các buổi dạy tại đây
    const centerPayroll = payrollByCenter.get(c.id) ?? 0;

    const profit = netRevenue - centerPayroll - expenseTotal;

    return {
      center: c,
      revenue,
      refund,
      netRevenue,
      teacherPayroll: centerPayroll,
      expenses: expenseTotal,
      profit,
      margin: netRevenue > 0 ? Math.round((profit / netRevenue) * 100) : 0,
    };
  });

  const totalRevenue = byCenter.reduce((s, c) => s + c.revenue, 0);
  const totalRefund = byCenter.reduce((s, c) => s + c.refund, 0);
  const totalNetRevenue = byCenter.reduce((s, c) => s + c.netRevenue, 0);
  const totalPayroll = byCenter.reduce((s, c) => s + c.teacherPayroll, 0);
  const totalExpenses = byCenter.reduce((s, c) => s + c.expenses, 0);
  const totalProfit = totalNetRevenue - totalPayroll - totalExpenses;

  return {
    month,
    summary: {
      revenue: totalRevenue,
      refund: totalRefund,
      netRevenue: totalNetRevenue,
      teacherPayroll: totalPayroll,
      expenses: totalExpenses,
      profit: totalProfit,
      margin: totalNetRevenue > 0 ? Math.round((totalProfit / totalNetRevenue) * 100) : 0,
    },
    byCenter,
  };
}

/** Báo cáo Giờ dạy & Lương Giáo viên theo tháng */
export async function getTeacherReport(params: { centerId?: number; month: string; viewer: Viewer }) {
  const { centerId, month, viewer } = params;
  allow(canSeeReports(viewer), "Không có quyền xem báo cáo");

  const teachers = await prisma.teacher.findMany({
    where: {
      status: "ACTIVE",
      ...(centerId ? { centers: { some: { centerId } } } : {}),
    },
    include: {
      centers: { include: { center: true } },
      payrollPeriods: { where: { month } },
    },
  });

  const sessions = await prisma.classSession.findMany({
    where: {
      date: { startsWith: month },
      status: { not: "CANCELLED" },
    },
    include: {
      class: { select: { teacherId: true, assistants: true } },
    },
  });

  const items = teachers.map((t) => {
    const teachingSessions = sessions.filter((s) => s.teacherId === t.id);
    const mainSessions = teachingSessions.filter((s) => s.class.teacherId === t.id);
    const substituteSessions = teachingSessions.filter((s) => s.class.teacherId !== t.id);
    const assistantSessions = sessions.filter((s) => s.class.assistants.some((a) => a.teacherId === t.id));

    const payroll = t.payrollPeriods[0];

    return {
      teacher: {
        id: t.id,
        fullName: t.fullName,
        displayName: t.displayName,
        code: t.code,
        role: t.role,
        employment: t.employment,
      },
      centers: t.centers.map((c) => c.center.name).join(", "),
      totalSessions: teachingSessions.length + assistantSessions.length,
      mainSessionsCount: mainSessions.length,
      substituteSessionsCount: substituteSessions.length,
      assistantSessionsCount: assistantSessions.length,
      totalHours: payroll?.totalHours ?? 0,
      totalSalary: payroll?.finalPay ?? 0,
      payrollStatus: payroll?.status ?? "DRAFT",
    };
  });

  return {
    month,
    items,
  };
}

/** Báo cáo Chuyên cần theo lớp */
export async function getAttendanceReport(params: {
  centerId?: number;
  classId?: number;
  fromDate?: string;
  toDate?: string;
  viewer: Viewer;
}) {
  const { centerId, classId, fromDate, toDate, viewer } = params;
  allow(canSeeReports(viewer), "Không có quyền xem báo cáo");

  const classes = await prisma.classGroup.findMany({
    where: {
      ...(centerId ? { centerId } : {}),
      ...(classId ? { id: classId } : {}),
    },
    include: {
      center: true,
      sessions: {
        where: {
          attendanceTakenAt: { not: null },
          ...(fromDate || toDate
            ? {
                date: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
        },
        include: { attendances: true },
      },
      enrollments: { where: { leftAt: null } },
    },
  });

  const items = classes.map((c) => {
    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;

    for (const s of c.sessions) {
      for (const a of s.attendances) {
        if (a.status === "PRESENT") present++;
        else if (a.status === "LATE") late++;
        else if (a.status === "EXCUSED") excused++;
        else if (a.status === "UNEXCUSED") unexcused++;
      }
    }

    const total = present + late + excused + unexcused;
    const attended = present + late;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 100;

    return {
      class: { id: c.id, name: c.name, code: c.code, centerName: c.center.name },
      sessionsRecorded: c.sessions.length,
      studentsCount: c.enrollments.length,
      present,
      late,
      excused,
      unexcused,
      attendanceRate,
    };
  });

  return { items };
}

/** Báo cáo học sinh trong tháng: theo trạng thái, ghi danh mới, bảo lưu, nghỉ theo lý do, tỷ lệ học tiếp. */
export async function getStudentReport(params: { centerId?: number; month: string; viewer: Viewer }) {
  const { centerId, month, viewer } = params;
  allow(canSeeReports(viewer), "Không có quyền xem báo cáo");
  const [from, to] = monthRange(month);
  const studentWhere = centerId ? { centerId } : {};

  const byStatus = await prisma.student.groupBy({ by: ["status"], where: studentWhere, _count: { _all: true } });

  const newEnrollments = await prisma.classEnrollment.findMany({
    where: { joinedAt: { gte: from, lte: to }, transferredFromId: null, ...(centerId ? { class: { centerId } } : {}) },
    include: {
      student: { select: { id: true, code: true, fullName: true } },
      class: { select: { code: true, name: true, course: { select: { name: true } } } },
    },
    orderBy: { joinedAt: "asc" },
  });

  const reservations = await prisma.reservation.findMany({
    where: { startDate: { gte: from, lte: to }, student: studentWhere },
    include: { student: { select: { id: true, code: true, fullName: true } } },
    orderBy: { startDate: "asc" },
  });

  // Đổi trạng thái sang "Đã nghỉ" trong tháng: lấy từ nhật ký thay đổi.
  const logs = await prisma.auditLog.findMany({
    where: {
      entity: "Student",
      action: "status",
      createdAt: { gte: new Date(`${from}T00:00:00+07:00`), lt: new Date(`${addDays(to, 1)}T00:00:00+07:00`) },
    },
    select: { entityId: true, changes: true },
  });
  const quitIds = [
    ...new Set(
      logs
        .filter((l) => {
          try {
            return (JSON.parse(l.changes) as { status?: [string, string] }).status?.[1] === "QUIT";
          } catch {
            return false;
          }
        })
        .map((l) => l.entityId),
    ),
  ];
  const quitStudents = quitIds.length
    ? await prisma.student.findMany({ where: { id: { in: quitIds }, ...studentWhere }, select: { id: true, code: true, fullName: true, status: true, statusReason: true } })
    : [];
  const reasons = new Map<string, number>();
  for (const s of quitStudents) {
    const r = s.status === "QUIT" && s.statusReason ? s.statusReason : "Không ghi lý do";
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }

  // Tỷ lệ học tiếp: lớp kết thúc trong tháng (buổi cuối nằm trong tháng), học sinh học đến cuối khóa.
  const finishedClasses = await prisma.classGroup.findMany({
    where: { status: "FINISHED", ...(centerId ? { centerId } : {}) },
    select: {
      id: true,
      sessions: { where: { status: { not: "CANCELLED" } }, select: { date: true }, orderBy: { date: "desc" }, take: 1 },
      enrollments: { where: { transferredTo: { is: null } }, select: { id: true, studentId: true, joinedAt: true, transferredFromId: true, leftAt: true } },
    },
  });
  const ended = finishedClasses
    .filter((c) => c.sessions[0] && c.sessions[0].date >= from && c.sessions[0].date <= to)
    .flatMap((c) => c.enrollments.filter((e) => !e.leftAt || e.leftAt >= c.sessions[0].date));
  const others = ended.length
    ? await prisma.classEnrollment.findMany({
        where: { studentId: { in: [...new Set(ended.map((e) => e.studentId))] } },
        select: { id: true, studentId: true, joinedAt: true, transferredFromId: true },
      })
    : [];

  return {
    month,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    newEnrollments: newEnrollments.map((e) => ({
      id: e.id,
      joinedAt: e.joinedAt,
      student: e.student,
      classCode: e.class.code,
      courseName: e.class.course?.name ?? e.class.name,
    })),
    reservations: reservations.map((r) => ({ id: r.id, startDate: r.startDate, expectedReturn: r.expectedReturn, reason: r.reason, student: r.student })),
    quits: quitStudents,
    quitReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    retention: computeRetention(ended, others),
  };
}

/** Báo cáo sử dụng lớp (tỷ lệ lấp đầy) và phòng (tỷ lệ dùng theo khung giờ) trong tháng. */
export async function getUtilizationReport(params: { centerId?: number; month: string; viewer: Viewer }) {
  const { centerId, month, viewer } = params;
  allow(canSeeReports(viewer), "Không có quyền xem báo cáo");
  const [from, to] = monthRange(month);

  const classes = await prisma.classGroup.findMany({
    where: { status: { in: ["PLANNED", "ACTIVE"] }, ...(centerId ? { centerId } : {}) },
    include: {
      center: { select: { name: true, color: true } },
      room: { select: { name: true, capacity: true } },
      teacher: { select: { displayName: true } },
      _count: { select: { enrollments: { where: { leftAt: null } } } },
    },
  });
  const classRows = classes
    .map((c) => {
      const capacity = Math.min(c.maxStudents, c.room.capacity);
      const enrolled = c._count.enrollments;
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        status: c.status,
        center: c.center,
        room: c.room.name,
        teacher: c.teacher.displayName,
        enrolled,
        capacity,
        free: Math.max(0, capacity - enrolled),
        fillRate: percent(enrolled, capacity) ?? 0,
      };
    })
    .sort((a, b) => a.fillRate - b.fillRate || a.code.localeCompare(b.code));

  const [rooms, holidays] = await Promise.all([
    prisma.room.findMany({
      where: { active: true, ...(centerId ? { centerId } : {}) },
      include: {
        center: { select: { id: true, name: true, color: true } },
        sessions: { where: { date: { gte: from, lte: to }, status: { not: "CANCELLED" } }, select: { roomId: true, startTime: true, endTime: true } },
      },
      orderBy: [{ centerId: "asc" }, { name: "asc" }],
    }),
    prisma.holiday.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, centerId: true } }),
  ]);
  const days = daysBetween(from, to);
  const roomRows = rooms.map((r) => {
    const closed = new Set(holidays.filter((h) => h.centerId == null || h.centerId === r.centerId).map((h) => h.date));
    const openDays = days.filter((d) => !closed.has(d)).length;
    return { id: r.id, name: r.name, center: r.center, capacity: r.capacity, sessions: r.sessions.length, openDays, ...roomUsage(r.sessions, openDays) };
  });

  const enrolled = classRows.reduce((s, c) => s + c.enrolled, 0);
  const capacity = classRows.reduce((s, c) => s + c.capacity, 0);
  return {
    month,
    summary: {
      classes: classRows.length,
      enrolled,
      capacity,
      fillRate: percent(enrolled, capacity),
      roomRate: roomRows.length ? Math.round(roomRows.reduce((s, r) => s + r.rate, 0) / roomRows.length) : null,
    },
    classes: classRows,
    rooms: roomRows,
  };
}
