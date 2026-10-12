// ==============================================================================
// KIỂM THỬ TÍCH HỢP TOÀN DIỆN 6 QUY TRÌNH NGHIỆP VỤ CỐT LÕI (MVP GIAI ĐOẠN 1)
// Theo đặc tả: "Tổng quan yêu cầu.md" Mục 4 & Mục 5
//
// 4.1 Ghi danh học sinh mới + Học phí/giảm giá + Thu tiền & Công nợ
// 4.2 Mở lớp mới + Chặn trùng phòng & giáo viên + Xếp học sinh chờ
// 4.3 Buổi học + Điểm danh + Cập nhật số buổi & Giờ dạy
// 4.4 Thay đổi lịch: Dạy thay + Hủy nối buổi + Học bù lớp khác
// 4.5 Kết thúc khóa + Điểm & Nhận xét tổng kết + Xuất học bạ gửi phụ huynh
// 4.6 Cuối tháng: Rà bảng giờ + Chốt lương + Ghi nhận chi phí + Báo cáo Lãi/Lỗ
// ==============================================================================

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as postParent } from "@/app/api/parents/route";
import { POST as postStudent } from "@/app/api/students/route";
import { POST as postClass } from "@/app/api/classes/route";
import { POST as postEnrollment } from "@/app/api/classes/[id]/enrollments/route";
import { PUT as putWaiting } from "@/app/api/students/[id]/waiting/route";
import { POST as postPayment } from "@/app/api/finance/payments/route";
import { GET as getDebts } from "@/app/api/finance/debts/route";
import { GET as getAttendance, PUT as putAttendance } from "@/app/api/sessions/[id]/attendance/route";
import { PATCH as patchSession } from "@/app/api/sessions/[id]/route";
import { POST as postMakeup } from "@/app/api/makeups/route";
import { PUT as putOutcome } from "@/app/api/classes/[id]/enrollments/[enrollmentId]/outcome/route";
import { GET as getPayroll } from "@/app/api/payroll/route";
import { POST as postAdjustment } from "@/app/api/payroll/[id]/adjustments/route";
import { POST as lockPayroll } from "@/app/api/payroll/[id]/lock/route";
import { POST as payPayroll } from "@/app/api/payroll/[id]/pay/route";
import { POST as postExpense } from "@/app/api/finance/expenses/route";
import { GET as getProfitLoss } from "@/app/api/reports/profit-loss/route";
import { addDays, todayISO } from "@/lib/dates";
import { buildCourseHistory, parentMessage } from "@/lib/history";
import { balancesFor } from "@/server/attendance";
import { createSession, SESSION_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

const tokens: Record<string, string> = {};
const USERS = ["quanly", "giaovu.a", "lan", "thu"];

async function call(
  handler: (req: Request, ctx: never) => Promise<Response>,
  url: string,
  who: string,
  init: RequestInit = {},
  params: Record<string, string> = {},
) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE}=${tokens[who]}`);
  const res = await handler(
    new Request(`http://localhost${url}`, { ...init, headers }),
    { params: Promise.resolve(params) } as never,
  );
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const put = (body: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(body) });
const patch = (body: unknown): RequestInit => ({ method: "PATCH", body: JSON.stringify(body) });

const today = todayISO();
const TEST_MONTH = "2098-11"; // Namespace riêng để không ảnh hưởng dữ liệu thật
let centerAId = 0;
let roomAId = 0;
let roomA2Id = 0;
let courseId = 0;
let lanTeacherId = 0;
let thuTeacherId = 0;

// Dữ liệu tạo trong test để dọn dẹp sau khi xong
const createdParentIds: number[] = [];
const createdStudentIds: number[] = [];
const createdClassIds: number[] = [];
async function cleanupTestData() {
  await prisma.payment.deleteMany({ where: { student: { fullName: { contains: "E2E" } } } });
  await prisma.refund.deleteMany({ where: { student: { fullName: { contains: "E2E" } } } });
  await prisma.makeup.deleteMany({ where: { student: { fullName: { contains: "E2E" } } } });
  await prisma.attendance.deleteMany({ where: { session: { class: { name: { contains: "E2E" } } } } });
  await prisma.attendance.deleteMany({ where: { student: { fullName: { contains: "E2E" } } } });
  await prisma.classSession.deleteMany({ where: { class: { name: { contains: "E2E" } } } });
  await prisma.classEnrollment.deleteMany({ where: { student: { fullName: { contains: "E2E" } } } });
  await prisma.classEnrollment.deleteMany({ where: { class: { name: { contains: "E2E" } } } });
  await prisma.studentGuardian.deleteMany({ where: { student: { fullName: { contains: "E2E" } } } });
  await prisma.studentGuardian.deleteMany({ where: { parent: { fullName: { contains: "E2E" } } } });
  await prisma.student.deleteMany({ where: { fullName: { contains: "E2E" } } });
  await prisma.parent.deleteMany({ where: { fullName: { contains: "E2E" } } });
  await prisma.classGroup.deleteMany({ where: { name: { contains: "E2E" } } });
  await prisma.expense.deleteMany({ where: { note: { contains: "cơ sở A" } } });
  await prisma.payrollPeriod.deleteMany({ where: { month: TEST_MONTH } });
}

beforeAll(async () => {
  for (const username of USERS) {
    const u = await prisma.user.findUniqueOrThrow({ where: { username } });
    tokens[username] = (await createSession(u.id)).token;
  }

  const centerA = await prisma.center.findUniqueOrThrow({
    where: { code: "A" },
    include: { rooms: true },
  });
  centerAId = centerA.id;
  roomAId = centerA.rooms[0].id;
  roomA2Id = centerA.rooms.length > 1 ? centerA.rooms[1].id : centerA.rooms[0].id;

  const course = await prisma.course.findFirstOrThrow();
  courseId = course.id;

  const lan = await prisma.teacher.findFirstOrThrow({ where: { displayName: "Ms Lan" } });
  lanTeacherId = lan.id;
  const john = await prisma.teacher.findFirstOrThrow({ where: { displayName: "Mr John" } });
  thuTeacherId = john.id;

  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.userSession.deleteMany({ where: { user: { username: { in: USERS } } } });
  await prisma.$disconnect();
});

describe("CHU TRÌNH 6 QUY TRÌNH NGHIỆP VỤ CỐT LÕI (E2E WORKFLOWS)", () => {
  let student1Id = 0;
  let student2Id = 0;
  let student3Id = 0;
  let testClassId = 0;
  let enrollment1Id = 0;
  let enrollment2Id = 0;
  let enrollment3Id = 0;

  // --------------------------------------------------------------------------
  // QUY TRÌNH 4.1: Ghi danh học sinh mới + Học phí/giảm giá + Thu tiền & Công nợ
  // --------------------------------------------------------------------------
  describe("Quy trình 4.1: Ghi danh học sinh mới, tính học phí và thu tiền", () => {
    it("1. Tạo phụ huynh và hồ sơ học sinh mới", async () => {
      const parentRes = await call(
        postParent,
        "/api/parents",
        "giaovu.a",
        post({
          fullName: "Phụ huynh E2E",
          phone: "0987111222",
          relation: "Mẹ",
        }),
      );
      expect(parentRes.status).toBe(200);
      createdParentIds.push(parentRes.data.id);

      const studentRes = await call(
        postStudent,
        "/api/students",
        "giaovu.a",
        post({
          student: {
            fullName: "Học sinh E2E One",
            gender: "FEMALE",
            dob: "2016-06-15",
            audience: "PRIMARY",
            centerId: centerAId,
            status: "WAITING",
          },
          parent: {
            fullName: "Phụ huynh E2E",
            phone: "0987111222",
            relation: "Mẹ",
          },
        }),
      );
      expect(studentRes.status).toBe(200);
      student1Id = studentRes.data.id;
      createdStudentIds.push(student1Id);

      // Thêm thêm 2 học sinh nữa phục vụ test điểm danh và học bù
      const s2 = await call(
        postStudent,
        "/api/students",
        "giaovu.a",
        post({
          student: {
            fullName: "Học sinh E2E Two",
            gender: "MALE",
            dob: "2015-08-20",
            audience: "SECONDARY",
            centerId: centerAId,
            status: "WAITING",
          },
          parent: {
            fullName: "Phụ huynh E2E 2",
            phone: "0987333444",
            relation: "Bố",
          },
        }),
      );
      expect(s2.status).toBe(200);
      student2Id = s2.data.id;
      createdStudentIds.push(student2Id);

      const s3 = await call(
        postStudent,
        "/api/students",
        "giaovu.a",
        post({
          student: {
            fullName: "Học sinh E2E Three",
            gender: "FEMALE",
            dob: "2017-03-10",
            audience: "PRIMARY",
            centerId: centerAId,
            status: "WAITING",
          },
          parent: {
            fullName: "Phụ huynh E2E 3",
            phone: "0987555666",
            relation: "Mẹ",
          },
        }),
      );
      expect(s3.status).toBe(200);
      student3Id = s3.data.id;
      createdStudentIds.push(student3Id);
    });

    it("2. Ghi danh kèm chính sách giảm giá SIBLING 10% và hẹn ngày đóng tiền", async () => {
      // Tìm lớp có sẵn của trung tâm A
      const existingClass = await prisma.classGroup.findFirstOrThrow({
        where: { centerId: centerAId, status: { in: ["PLANNED", "ACTIVE"] } },
      });

      // Học phí gốc 2.000.000đ, giảm 10% = 1.800.000đ
      const enrollRes = await call(
        postEnrollment,
        `/api/classes/${existingClass.id}/enrollments`,
        "giaovu.a",
        post({
          studentId: student1Id,
          purchasedSessions: 10,
          tuitionFee: 1800000,
          discountType: "SIBLING",
          discountMode: "PERCENT",
          discountValue: 10,
          dueDate: addDays(today, 7),
        }),
        { id: String(existingClass.id) },
      );
      expect(enrollRes.status).toBe(200);
      enrollment1Id = enrollRes.data.id;
      expect(enrollRes.data.tuitionFee).toBe(1800000);
      expect(enrollRes.data.discountType).toBe("SIBLING");

      // Kiểm tra công nợ ban đầu: chưa đóng tiền -> UNPAID
      const debtRes = await call(getDebts, "/api/finance/debts", "giaovu.a");
      expect(debtRes.status).toBe(200);
      const studentDebt = debtRes.data.items.find((d: any) => d.enrollmentId === enrollment1Id);
      expect(studentDebt).toBeDefined();
      expect(studentDebt.finalFee).toBe(1800000);
      expect(studentDebt.paidAmount).toBe(0);
      expect(studentDebt.debtAmount).toBe(1800000);
      expect(studentDebt.status).toBe("UNPAID");
    });

    it("3. Thu tiền đợt 1 -> Công nợ cập nhật sang PARTIAL, thu đợt 2 -> hoàn tất PAID", async () => {
      // Thu đợt 1: 1.000.000đ
      const pay1Res = await call(
        postPayment,
        "/api/finance/payments",
        "giaovu.a",
        post({
          enrollmentId: enrollment1Id,
          amount: 1000000,
          date: today,
          method: "CASH",
          note: "Thu đợt 1",
        }),
      );
      expect(pay1Res.status).toBe(200);
      expect(pay1Res.data.code).toContain("PT-");

      // Rà soát công nợ: còn nợ 800.000đ, trạng thái PARTIAL
      const debt1Res = await call(getDebts, "/api/finance/debts", "giaovu.a");
      const debtAfter1 = debt1Res.data.items.find((d: any) => d.enrollmentId === enrollment1Id);
      expect(debtAfter1.paidAmount).toBe(1000000);
      expect(debtAfter1.debtAmount).toBe(800000);
      expect(debtAfter1.status).toBe("PARTIAL");

      // Thu đợt 2: 800.000đ hoàn tất học phí
      const pay2Res = await call(
        postPayment,
        "/api/finance/payments",
        "giaovu.a",
        post({
          enrollmentId: enrollment1Id,
          amount: 800000,
          date: today,
          method: "TRANSFER",
          note: "Thu đợt 2 đủ",
        }),
      );
      expect(pay2Res.status).toBe(200);

      // Công nợ = 0 -> PAID
      const debt2Res = await call(getDebts, "/api/finance/debts", "giaovu.a");
      const debtAfter2 = debt2Res.data.items.find((d: any) => d.enrollmentId === enrollment1Id);
      expect(debtAfter2.paidAmount).toBe(1800000);
      expect(debtAfter2.debtAmount).toBe(0);
      expect(debtAfter2.status).toBe("PAID");
    });
  });

  // --------------------------------------------------------------------------
  // QUY TRÌNH 4.2: Mở lớp mới + Chặn trùng phòng & giáo viên + Xếp học sinh chờ
  // --------------------------------------------------------------------------
  describe("Quy trình 4.2: Mở lớp mới, chặn trùng lịch và xếp học sinh chờ", () => {
    it("1. Chặn mở lớp khi trùng phòng vào cùng khung giờ", async () => {
      // Lấy lịch của một buổi đã có trong phòng A
      const existingSession = await prisma.classSession.findFirstOrThrow({
        where: { roomId: roomAId, status: "SCHEDULED" },
        include: { class: true },
      });

      // Thử tạo lớp mới dùng chung phòng và khung giờ
      const conflictRes = await call(
        postClass,
        "/api/classes",
        "giaovu.a",
        post({
          name: "Lớp Test Trùng Phòng",
          centerId: centerAId,
          roomId: roomAId,
          teacherId: thuTeacherId,
          weekdays: [1, 3, 5],
          startTime: existingSession.startTime,
          endTime: existingSession.endTime,
          startDate: existingSession.date,
          totalSessions: 12,
          maxStudents: 10,
        }),
      );
      expect(conflictRes.status).toBe(409);
      expect(conflictRes.data.error).toContain("Không thể lưu");
    });

    it("2. Mở lớp mới hợp lệ thành công và tự động sinh lịch buổi học", async () => {
      const newClassRes = await call(
        postClass,
        "/api/classes",
        "giaovu.a",
        post({
          name: "Lớp E2E Ban Đêm",
          centerId: centerAId,
          roomId: roomA2Id,
          teacherId: lanTeacherId,
          weekdays: [2, 4],
          startTime: "21:15",
          endTime: "22:45",
          startDate: today,
          totalSessions: 6,
          maxStudents: 12,
        }),
      );
      expect(newClassRes.status).toBe(200);
      testClassId = newClassRes.data.id;
      createdClassIds.push(testClassId);

      // Kiểm tra danh sách buổi học được sinh tự động
      const sessions = await prisma.classSession.findMany({ where: { classId: testClassId } });
      expect(sessions.length).toBe(6);
      expect(sessions[0].startTime).toBe("21:15");
      expect(sessions[0].teacherId).toBe(lanTeacherId);
    });

    it("3. Đưa học sinh vào danh sách 'Chờ xếp lớp' rồi xếp vào lớp mới", async () => {
      // Đặt học sinh 2 vào chờ xếp lớp
      const waitRes = await call(
        putWaiting,
        `/api/students/${student2Id}/waiting`,
        "giaovu.a",
        put({ courseId }),
        { id: String(student2Id) },
      );
      expect(waitRes.status).toBe(200);
      expect(waitRes.data.waitingCourseId).toBe(courseId);
      expect(waitRes.data.status).toBe("WAITING");

      // Xếp học sinh 2 và 3 vào lớp mới tạo
      const e2 = await call(
        postEnrollment,
        `/api/classes/${testClassId}/enrollments`,
        "giaovu.a",
        post({ studentId: student2Id, purchasedSessions: 6 }),
        { id: String(testClassId) },
      );
      expect(e2.status).toBe(200);
      enrollment2Id = e2.data.id;

      const e3 = await call(
        postEnrollment,
        `/api/classes/${testClassId}/enrollments`,
        "giaovu.a",
        post({ studentId: student3Id, purchasedSessions: 6 }),
        { id: String(testClassId) },
      );
      expect(e3.status).toBe(200);
      enrollment3Id = e3.data.id;

      // Học sinh 2 không còn chờ xếp lớp và đổi thành STUDYING
      const student2Check = await prisma.student.findUniqueOrThrow({ where: { id: student2Id } });
      expect(student2Check.waitingCourseId).toBeNull();
      expect(student2Check.status).toBe("STUDYING");
    });
  });

  // --------------------------------------------------------------------------
  // QUY TRÌNH 4.3: Điểm danh buổi học + Cập nhật số buổi & Giờ dạy
  // --------------------------------------------------------------------------
  describe("Quy trình 4.3: Điểm danh buổi học và cập nhật số buổi", () => {
    let targetSessionId = 0;

    it("1. Giáo viên mở danh sách lớp và điểm danh", async () => {
      // Đặt buổi đầu tiên về hôm nay hoặc quá khứ để được phép điểm danh
      const firstSession = await prisma.classSession.findFirstOrThrow({
        where: { classId: testClassId },
        orderBy: { index: "asc" },
      });
      await prisma.classSession.update({
        where: { id: firstSession.id },
        data: { date: today },
      });
      targetSessionId = firstSession.id;

      // Giáo viên Ms Lan mở buổi điểm danh
      const attInfo = await call(
        getAttendance,
        `/api/sessions/${targetSessionId}/attendance`,
        "lan",
        {},
        { id: String(targetSessionId) },
      );
      expect(attInfo.status).toBe(200);
      expect(attInfo.data.canEdit).toBe(true);
      expect(attInfo.data.roster.length).toBeGreaterThanOrEqual(2);

      // Điểm danh:
      // - Học sinh 2: PRESENT (Có mặt)
      // - Học sinh 3: EXCUSED (Vắng có phép)
      const saveAtt = await call(
        putAttendance,
        `/api/sessions/${targetSessionId}/attendance`,
        "lan",
        put({
          lessonContent: "Unit 1: Introductions and Greetings",
          items: [
            { studentId: student2Id, status: "PRESENT", comment: "Rất hăng hái" },
            { studentId: student3Id, status: "EXCUSED", comment: "Bị ốm có xin phép" },
          ],
        }),
        { id: String(targetSessionId) },
      );
      expect(saveAtt.status).toBe(200);
    });

    it("2. Kiểm tra quy tắc trừ buổi: Có mặt bị trừ 1, Vắng có phép KHÔNG bị trừ", async () => {
      const balances = await balancesFor(prisma, [enrollment2Id, enrollment3Id]);
      const bal2 = balances.get(enrollment2Id)!;
      const bal3 = balances.get(enrollment3Id)!;

      // Học sinh 2: mua 6, PRESENT 1 -> còn 5 buổi
      expect(bal2.purchased).toBe(6);
      expect(bal2.used).toBe(1);
      expect(bal2.remaining).toBe(5);

      // Học sinh 3: mua 6, EXCUSED 1 -> không tính trừ buổi -> vẫn còn nguyên 6 buổi!
      expect(bal3.purchased).toBe(6);
      expect(bal3.used).toBe(0);
      expect(bal3.remaining).toBe(6);
    });
  });

  // --------------------------------------------------------------------------
  // QUY TRÌNH 4.4: Thay đổi lịch: Dạy thay + Hủy nối buổi + Học bù lớp khác
  // --------------------------------------------------------------------------
  describe("Quy trình 4.4: Dạy thay, hủy/nối buổi học và xếp học bù lớp khác", () => {
    it("1. Xếp giáo viên dạy thay cho buổi học", async () => {
      const session2 = await prisma.classSession.findFirstOrThrow({
        where: { classId: testClassId, index: 2 },
      });

      // Đổi người dạy từ Ms Lan sang Ms Thu
      const subRes = await call(
        patchSession,
        `/api/sessions/${session2.id}`,
        "giaovu.a",
        patch({
          action: "change",
          teacherId: thuTeacherId,
          note: "Mr John dạy thay do Ms Lan bận họp",
        }),
        { id: String(session2.id) },
      );
      expect(subRes.status).toBe(200);

      const updated = await prisma.classSession.findUniqueOrThrow({ where: { id: session2.id } });
      expect(updated.teacherId).toBe(thuTeacherId);
      expect(updated.note).toContain("dạy thay");
    });

    it("2. Hủy buổi học và tự động nối buổi bù vào cuối lịch", async () => {
      const session3 = await prisma.classSession.findFirstOrThrow({
        where: { classId: testClassId, index: 3 },
      });

      const cancelRes = await call(
        patchSession,
        `/api/sessions/${session3.id}`,
        "giaovu.a",
        patch({
          action: "cancel",
          reason: "Nghỉ đột xuất vì thời tiết xấu",
          appendAtEnd: true,
        }),
        { id: String(session3.id) },
      );
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.data.appended).toBeDefined();

      // Buổi cũ thành CANCELLED
      const oldSession = await prisma.classSession.findUniqueOrThrow({ where: { id: session3.id } });
      expect(oldSession.status).toBe("CANCELLED");

      // Có thêm buổi bù index 7 ở cuối lịch
      const newSession = await prisma.classSession.findFirstOrThrow({
        where: { classId: testClassId, index: 7 },
      });
      expect(newSession).toBeDefined();
      expect(newSession.status).toBe("SCHEDULED");
    });

    it("3. Xếp học bù cho học sinh vắng có phép sang buổi lớp khác", async () => {
      // Tìm buổi vắng có phép của học sinh 3 ở quy trình 4.3
      const absenceAtt = await prisma.attendance.findFirstOrThrow({
        where: { studentId: student3Id, status: "EXCUSED" },
      });

      // Tìm một buổi học ở tương lai của lớp khác
      const otherClassSession = await prisma.classSession.findFirstOrThrow({
        where: {
          classId: { not: testClassId },
          date: { gte: today },
          status: "SCHEDULED",
        },
      });

      // Xếp học bù
      const makeupRes = await call(
        postMakeup,
        "/api/makeups",
        "giaovu.a",
        post({
          absenceId: absenceAtt.id,
          sessionId: otherClassSession.id,
        }),
      );
      expect(makeupRes.status).toBe(200);

      // Kiểm tra trong danh sách điểm danh của lớp đó: học sinh 3 xuất hiện với cờ makeup = true
      const rosterCheck = await call(
        getAttendance,
        `/api/sessions/${otherClassSession.id}/attendance`,
        "quanly",
        {},
        { id: String(otherClassSession.id) },
      );
      const studentOnRoster = rosterCheck.data.roster.find((r: any) => r.studentId === student3Id);
      expect(studentOnRoster).toBeDefined();
      expect(studentOnRoster.makeup).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // QUY TRÌNH 4.5: Kết thúc khóa + Điểm & Nhận xét tổng kết + Xuất học bạ
  // --------------------------------------------------------------------------
  describe("Quy trình 4.5: Ghi nhận kết quả cuối khóa và xuất học bạ", () => {
    it("1. Giáo viên ghi nhận kết quả và nhận xét cuối khóa", async () => {
      const outcomeRes = await call(
        putOutcome,
        `/api/classes/${testClassId}/enrollments/${enrollment2Id}/outcome`,
        "lan",
        put({
          outcome: "COMPLETED",
          finalComment: "Học sinh hoàn thành xuất sắc khóa học, phản xạ nói tự tin.",
        }),
        { id: String(testClassId), enrollmentId: String(enrollment2Id) },
      );
      expect(outcomeRes.status).toBe(200);
      expect(outcomeRes.data.outcome).toBe("COMPLETED");
      expect(outcomeRes.data.finalComment).toContain("xuất sắc");
    });

    it("2. Tổng hợp lịch sử học tập và sinh tin nhắn xuất gửi phụ huynh", async () => {
      const enrollData = await prisma.classEnrollment.findUniqueOrThrow({
        where: { id: enrollment2Id },
        include: {
          class: {
            include: {
              center: { select: { name: true, color: true } },
              teacher: { select: { displayName: true } },
              course: { select: { name: true } },
            },
          },
          attendances: {
            include: {
              session: { select: { id: true, index: true, date: true, startTime: true, endTime: true, lessonContent: true, class: { select: { code: true } } } },
              makeup: { select: { absence: { select: { status: true, session: { select: { date: true } } } } } },
              makeupFor: { select: { id: true, session: { select: { date: true, startTime: true, class: { select: { code: true } } } }, attendance: { select: { status: true } } } },
            },
          },
        },
      });

      const historyRuns = buildCourseHistory([
        {
          id: enrollData.id,
          joinedAt: enrollData.joinedAt,
          leftAt: enrollData.leftAt,
          transferredFromId: enrollData.transferredFromId,
          outcome: enrollData.outcome,
          finalComment: enrollData.finalComment,
          outcomeBy: enrollData.outcomeBy,
          balance: null,
          attendances: enrollData.attendances as any,
          class: {
            ...enrollData.class,
            center: { ...enrollData.class.center, address: null },
          },
        },
      ]);
      expect(historyRuns.length).toBe(1);
      expect(historyRuns[0].summary.held).toBeGreaterThanOrEqual(1);

      // Sinh tin nhắn gửi phụ huynh
      const msg = parentMessage(
        { fullName: "Học sinh E2E Two", englishName: "Leo" },
        historyRuns[0],
        "Hoàn thành khóa",
        enrollData.class.center.name,
      );
      expect(msg).toContain("Học sinh E2E Two (Leo)");
      expect(msg).toContain("Kết quả: Hoàn thành khóa");
      expect(msg).toContain("Nhận xét của giáo viên: Học sinh hoàn thành xuất sắc");
    });
  });

  // --------------------------------------------------------------------------
  // QUY TRÌNH 4.6: Cuối tháng: Bảng giờ + Chốt lương + Chi phí + Báo cáo Lãi/Lỗ
  // --------------------------------------------------------------------------
  describe("Quy trình 4.6: Quản lý tính lương, chốt kỳ lương và xem báo cáo lãi/lỗ", () => {
    let periodId = 0;

    it("1. Quản lý xem bảng lương tháng và ghi nhận giờ dạy thực tế", async () => {
      // Đảm bảo giáo viên có đơn giá lương hợp lệ
      await prisma.teacherRate.upsert({
        where: { id: 99999 },
        create: {
          id: 99999,
          teacherId: lanTeacherId,
          role: "TEACHER",
          hourlyRate: 200000,
          effectiveDate: "2020-01-01",
        },
        update: {},
      });

      // Tạo một buổi dạy trong tháng test cho Ms Lan để tính lương
      const testSessionDate = `${TEST_MONTH}-10`;
      await prisma.classSession.create({
        data: {
          classId: testClassId,
          index: 10,
          date: testSessionDate,
          startTime: "18:00",
          endTime: "20:00", // 2 giờ
          roomId: roomA2Id,
          teacherId: lanTeacherId,
        },
      });

      const payrollRes = await call(getPayroll, `/api/payroll?month=${TEST_MONTH}`, "quanly");
      expect(payrollRes.status).toBe(200);
      const lanPayroll = payrollRes.data.find((p: any) => p.teacher.id === lanTeacherId);
      expect(lanPayroll).toBeDefined();
      expect(lanPayroll.sessionsCount).toBeGreaterThanOrEqual(1);
      expect(lanPayroll.calculated.totalHours).toBeGreaterThanOrEqual(2);
      expect(lanPayroll.calculated.teachingPay).toBeGreaterThanOrEqual(400000); // 2 giờ * 200k = 400k

      periodId = lanPayroll.period.id;
    });

    it("2. Thêm thưởng/phạt điều chỉnh lương", async () => {
      const adjRes = await call(
        postAdjustment,
        `/api/payroll/${periodId}/adjustments`,
        "quanly",
        post({
          payrollPeriodId: periodId,
          type: "BONUS",
          amount: 100000,
          note: "Thưởng giáo viên năng nổ",
        }),
        { id: String(periodId) },
      );
      expect(adjRes.status).toBe(200);
      expect(adjRes.data.amount).toBe(100000);
    });

    it("3. Chốt bảng lương (LOCK) và ghi nhận thanh toán (PAY)", async () => {
      // Chốt lương
      const lockRes = await call(
        lockPayroll,
        `/api/payroll/${periodId}/lock`,
        "quanly",
        post({}),
        { id: String(periodId) },
      );
      expect(lockRes.status).toBe(200);
      expect(lockRes.data.status).toBe("LOCKED");

      // Thanh toán
      const payRes = await call(
        payPayroll,
        `/api/payroll/${periodId}/pay`,
        "quanly",
        post({}),
        { id: String(periodId) },
      );
      expect(payRes.status).toBe(200);
      expect(payRes.data.status).toBe("PAID");
    });

    it("4. Ghi nhận chi phí vận hành trung tâm", async () => {
      const expRes = await call(
        postExpense,
        "/api/finance/expenses",
        "quanly",
        post({
          centerId: centerAId,
          category: "RENT",
          amount: 5000000,
          date: today,
          payer: "Quản lý Trung tâm",
          note: "Tiền thuê mặt bằng cơ sở A",
        }),
      );
      expect(expRes.status).toBe(200);
      expect(expRes.data.code).toContain("CP-");
    });

    it("5. Báo cáo Lãi/Lỗ theo trung tâm tính đúng công thức Doanh thu - Chi phí - Lương", async () => {
      const currentMonth = today.slice(0, 7);
      const repRes = await call(
        getProfitLoss,
        `/api/reports/profit-loss?month=${currentMonth}`,
        "quanly",
      );
      expect(repRes.status).toBe(200);
      expect(repRes.data.summary).toBeDefined();

      const summary = repRes.data.summary;
      // Công thức: profit = netRevenue - teacherPayroll - expenses
      expect(summary.profit).toBe(summary.netRevenue - summary.teacherPayroll - summary.expenses);
    });
  });
});
