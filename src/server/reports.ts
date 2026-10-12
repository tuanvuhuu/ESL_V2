import { todayISO } from "@/lib/dates";
import { canSeeReports, type Viewer } from "@/lib/permissions";
import { prisma } from "./db";
import { allow } from "./http";

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
  });

  // Các phiếu hoàn tiền
  const refunds = await prisma.refund.findMany({
    where: {
      status: "VALID",
      date: { gte: fromDate, lte: toDate },
      ...(centerId ? { centerId } : {}),
    },
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

  const totalPaid = byCenter.reduce((s, c) => s + c.paidTotal, 0);
  const totalRefund = byCenter.reduce((s, c) => s + c.refundTotal, 0);
  const totalNet = totalPaid - totalRefund;

  return {
    fromMonth,
    toMonth,
    summary: { totalPaid, totalRefund, totalNet },
    byCenter,
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

  // 4. Lương giáo viên theo trung tâm:
  const payrollPeriods = await prisma.payrollPeriod.findMany({
    where: {
      month,
      centerId: centerId ? centerId : undefined,
    },
  });

  const byCenter = centers.map((c) => {
    const cPayments = payments.filter((p) => p.centerId === c.id);
    const cRefunds = refunds.filter((r) => r.centerId === c.id);
    const cExpenses = expenses.filter((e) => e.centerId === c.id);

    const revenue = cPayments.reduce((s, p) => s + p.amount, 0);
    const refund = cRefunds.reduce((s, r) => s + r.amount, 0);
    const netRevenue = revenue - refund;

    const expenseTotal = cExpenses.reduce((s, e) => s + e.amount, 0);

    // Tính lương giáo viên tại trung tâm này
    const centerPayroll = payrollPeriods.filter((p) => p.centerId === c.id).reduce((s, p) => s + p.finalPay, 0);

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
