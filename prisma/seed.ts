// Dữ liệu mẫu để chạy thử: 4 trung tâm, phòng, khóa học, giáo viên, học sinh, phụ huynh và vài lớp.
import { PrismaClient } from "@prisma/client";
import { addDays, startOfWeek, todayISO } from "../src/lib/dates";
import { generateSessionDates } from "../src/lib/schedule";
import { buildSearchText, formatCode } from "../src/lib/text";
import { hashPassword } from "../src/server/auth";

const prisma = new PrismaClient();

const CENTERS = [
  { code: "A", name: "Trung tâm A", color: "#1F6FEB", address: "12 Nguyễn Trãi, Q.1" },
  { code: "B", name: "Trung tâm B", color: "#2DA44E", address: "45 Lê Lợi, Q.3" },
  { code: "C", name: "Trung tâm C", color: "#BF5AF2", address: "88 Phan Xích Long, Phú Nhuận" },
  { code: "D", name: "Trung tâm D", color: "#F0883E", address: "201 Quang Trung, Gò Vấp" },
];

const COURSES = [
  { name: "Kids 1", program: "Kids", level: "Starters", totalSessions: 36, sessionMinutes: 90, tuition: 5400000, maxStudents: 12 },
  { name: "Kids 2", program: "Kids", level: "Movers", totalSessions: 36, sessionMinutes: 90, tuition: 5800000, maxStudents: 12 },
  { name: "Teens 1", program: "Teens", level: "KET", totalSessions: 30, sessionMinutes: 90, tuition: 6200000, maxStudents: 15 },
  { name: "IELTS Foundation", program: "IELTS", level: "4.0–5.0", totalSessions: 24, sessionMinutes: 120, tuition: 7500000, maxStudents: 15 },
  { name: "Giao tiếp người lớn", program: "Adult", level: "A2–B1", totalSessions: 24, sessionMinutes: 90, tuition: 4800000, maxStudents: 10 },
];

const TEACHERS = [
  { fullName: "Nguyễn Thị Lan", displayName: "Ms Lan", role: "TEACHER", origin: "VN", employment: "FULL_TIME", centers: ["A", "B"] },
  { fullName: "John Smith", displayName: "Mr John", role: "TEACHER", origin: "FOREIGN", employment: "PART_TIME", centers: ["A", "C"] },
  { fullName: "Trần Văn Nam", displayName: "Mr Nam", role: "BOTH", origin: "VN", employment: "FULL_TIME", centers: ["B"] },
  { fullName: "Lê Thị Hoa", displayName: "Ms Hoa", role: "TEACHER", origin: "VN", employment: "PART_TIME", centers: ["C", "D"] },
  { fullName: "Emily Brown", displayName: "Ms Emily", role: "TEACHER", origin: "FOREIGN", employment: "PART_TIME", centers: ["D"] },
  { fullName: "Phạm Minh Thư", displayName: "Thư", role: "ASSISTANT", origin: "VN", employment: "PART_TIME", centers: ["A"] },
  { fullName: "Võ Quốc Huy", displayName: "Huy", role: "ASSISTANT", origin: "VN", employment: "PART_TIME", centers: ["B", "C"] },
  { fullName: "Đỗ Ngọc Anh", displayName: "Ngọc Anh", role: "ASSISTANT", origin: "VN", employment: "PART_TIME", centers: ["D"] },
];

const DEMO_PASSWORD = "matkhau123";

const LAST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ"];
const MID = ["Minh", "Gia", "Bảo", "Ngọc", "Khánh", "Thảo", "Anh", "Đức", "Hải", "Thanh"];
const FIRST_M = ["An", "Khoa", "Huy", "Phúc", "Nam", "Long", "Quân", "Tùng"];
const FIRST_F = ["Vy", "Linh", "Chi", "Hân", "My", "Trang", "Nhi", "Ngân"];
const EN_M = ["Andy", "Ben", "Kevin", "Tom", "Leo", "Max"];
const EN_F = ["Anna", "Lily", "Emma", "Mia", "Sophie", "Zoe"];

async function main() {
  await prisma.$transaction([
    prisma.userSession.deleteMany(),
    prisma.user.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.classEnrollment.deleteMany(),
    prisma.classSession.deleteMany(),
    prisma.classAssistant.deleteMany(),
    prisma.classGroup.deleteMany(),
    prisma.studentGuardian.deleteMany(),
    prisma.student.deleteMany(),
    prisma.parent.deleteMany(),
    prisma.teacherCenter.deleteMany(),
    prisma.teacher.deleteMany(),
    prisma.holiday.deleteMany(),
    prisma.room.deleteMany(),
    prisma.course.deleteMany(),
    prisma.center.deleteMany(),
  ]);

  const centers = [];
  for (const c of CENTERS) {
    centers.push(
      await prisma.center.create({
        data: {
          ...c,
          openHours: "08:00–21:00",
          rooms: {
            create: [
              { name: "P101", capacity: 12, equipment: "Máy chiếu, loa" },
              { name: "P102", capacity: 15, equipment: "Tivi" },
              { name: "P201", capacity: 10 },
            ],
          },
        },
        include: { rooms: true },
      }),
    );
  }
  const byCode = Object.fromEntries(centers.map((c) => [c.code, c]));

  const courses = [];
  for (const c of COURSES) courses.push(await prisma.course.create({ data: c }));

  const year = Number(todayISO().slice(0, 4));
  const holidays = [
    { date: `${year}-01-01`, name: "Tết Dương lịch" },
    { date: `${year}-04-30`, name: "Giải phóng miền Nam" },
    { date: `${year}-05-01`, name: "Quốc tế Lao động" },
    { date: `${year}-09-02`, name: "Quốc khánh" },
    { date: `${year + 1}-01-01`, name: "Tết Dương lịch" },
  ];
  for (const h of holidays) await prisma.holiday.create({ data: h });

  const teachers = [];
  for (const [i, t] of TEACHERS.entries()) {
    const code = formatCode("GV", i + 1, 4);
    const phone = `09${String(10000000 + i * 1234567).slice(0, 8)}`;
    teachers.push(
      await prisma.teacher.create({
        data: {
          code,
          fullName: t.fullName,
          displayName: t.displayName,
          role: t.role,
          origin: t.origin,
          employment: t.employment,
          phone,
          startDate: `${year - 1}-0${(i % 9) + 1}-01`,
          searchText: buildSearchText([code, t.fullName, t.displayName, phone]),
          centers: { create: t.centers.map((c) => ({ centerId: byCode[c].id })) },
        },
      }),
    );
  }
  const T = Object.fromEntries(teachers.map((t) => [t.displayName, t]));

  // Học sinh và phụ huynh; vài gia đình có 2 con để thấy anh chị em.
  const students: { id: number; parentId: number; centerCode: string; status: string }[] = [];
  let parentSeq = 0;
  for (let i = 0; i < 36; i++) {
    const male = i % 2 === 0;
    const fullName = `${LAST[i % LAST.length]} ${MID[(i * 3) % MID.length]} ${male ? FIRST_M[i % FIRST_M.length] : FIRST_F[i % FIRST_F.length]}`;
    const center = centers[i % 4];
    const age = 6 + (i % 10);
    const dob = `${year - age}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`;
    const sibling = i % 7 === 6 && students.length > 0;
    let parent: { id: number };
    if (sibling) {
      const prev = students[students.length - 1];
      parent = await prisma.parent.findUniqueOrThrow({ where: { id: prev.parentId } });
    } else {
      parentSeq++;
      parent = await prisma.parent.create({
        data: {
          fullName: `${LAST[(i + 5) % LAST.length]} Thị ${["Hương", "Mai", "Lan", "Thu", "Hà"][i % 5]}`,
          phone: `09${String(12345678 + parentSeq * 7919).slice(0, 8)}`,
          zalo: i % 3 === 0 ? null : "Có",
        },
      });
    }
    const s = await prisma.student.create({
      data: {
        code: `TMP${i}`,
        fullName,
        englishName: i % 3 === 0 ? null : male ? EN_M[i % EN_M.length] : EN_F[i % EN_F.length],
        dob,
        gender: male ? "MALE" : "FEMALE",
        audience: age <= 10 ? "PRIMARY" : age <= 14 ? "SECONDARY" : "HIGH",
        school: `Trường ${["Lê Quý Đôn", "Nguyễn Du", "Trần Đại Nghĩa", "Kim Đồng"][i % 4]}`,
        centerId: center.id,
        status: i % 11 === 10 ? "RESERVED" : i % 13 === 12 ? "QUIT" : "WAITING",
        statusReason: i % 13 === 12 && i % 11 !== 10 ? "Chuyển nhà" : null,
        guardians: { create: { parentId: parent.id, relation: i % 3 === 0 ? "Bố" : "Mẹ", isPrimary: true, isPayer: true } },
      },
    });
    await prisma.student.update({ where: { id: s.id }, data: { code: formatCode("HS", s.id) } });
    students.push({ ...s, parentId: parent.id, centerCode: center.code });
  }
  // Chuỗi tìm kiếm.
  for (const s of await prisma.student.findMany({ include: { guardians: { include: { parent: true } } } })) {
    await prisma.student.update({
      where: { id: s.id },
      data: { searchText: buildSearchText([s.code, s.fullName, s.englishName, ...s.guardians.flatMap((g) => [g.parent.fullName, g.parent.phone])]) },
    });
  }
  for (const p of await prisma.parent.findMany({ include: { children: { include: { student: true } } } })) {
    await prisma.parent.update({
      where: { id: p.id },
      data: { searchText: buildSearchText([p.fullName, p.phone, p.zalo, ...p.children.flatMap((c) => [c.student.fullName, c.student.englishName])]) },
    });
  }

  // Lớp: khai giảng từ 3 tuần trước để có cả buổi đã diễn ra và sắp tới.
  const start = addDays(startOfWeek(todayISO()), -21);
  const allHolidays = await prisma.holiday.findMany();
  const CLASSES = [
    { name: "KID1-Lions", center: "A", room: "P101", teacher: "Ms Lan", assistants: ["Thư"], course: 0, weekdays: [1, 3, 5], time: ["17:30", "19:00"] },
    { name: "IELTS-A", center: "A", room: "P102", teacher: "Mr John", assistants: [], course: 3, weekdays: [2, 4], time: ["18:00", "20:00"] },
    { name: "TEENS1-Eagles", center: "B", room: "P101", teacher: "Mr Nam", assistants: ["Huy"], course: 2, weekdays: [2, 4, 6], time: ["18:00", "19:30"] },
    { name: "KID2-Tigers", center: "B", room: "P102", teacher: "Ms Lan", assistants: [], course: 1, weekdays: [6, 7], time: ["08:30", "10:00"] },
    { name: "GT-B", center: "C", room: "P201", teacher: "Ms Hoa", assistants: [], course: 4, weekdays: [1, 3], time: ["19:00", "20:30"] },
    { name: "IELTS-C", center: "C", room: "P101", teacher: "Mr John", assistants: ["Huy"], course: 3, weekdays: [6], time: ["14:00", "16:00"] },
    { name: "KID1-Bears", center: "D", room: "P101", teacher: "Ms Emily", assistants: ["Ngọc Anh"], course: 0, weekdays: [2, 4, 6], time: ["17:30", "19:00"] },
  ];
  for (const [i, c] of CLASSES.entries()) {
    const center = byCode[c.center];
    const room = center.rooms.find((r) => r.name === c.room)!;
    const course = courses[c.course];
    const { dates } = generateSessionDates({
      startDate: start,
      weekdays: c.weekdays,
      totalSessions: course.totalSessions,
      centerId: center.id,
      holidays: allHolidays,
    });
    const cls = await prisma.classGroup.create({
      data: {
        code: `${center.code}${formatCode("L", i + 1, 4)}`,
        name: c.name,
        courseId: course.id,
        centerId: center.id,
        roomId: room.id,
        teacherId: T[c.teacher].id,
        status: "ACTIVE",
        weekdays: c.weekdays.join(","),
        startTime: c.time[0],
        endTime: c.time[1],
        startDate: start,
        totalSessions: course.totalSessions,
        maxStudents: course.maxStudents,
        assistants: { create: c.assistants.map((a) => ({ teacherId: T[a].id })) },
        sessions: {
          create: dates.map((date, idx) => ({
            index: idx + 1,
            date,
            startTime: c.time[0],
            endTime: c.time[1],
            roomId: room.id,
            teacherId: T[c.teacher].id,
          })),
        },
      },
    });
    const pool = students.filter((s) => s.centerCode === c.center && s.status === "WAITING").slice(0, 5);
    for (const s of pool) {
      await prisma.classEnrollment.create({ data: { classId: cls.id, studentId: s.id, joinedAt: start } });
      await prisma.student.update({ where: { id: s.id }, data: { status: "STUDYING" } });
      s.status = "STUDYING";
    }
  }

  // Tài khoản chạy thử, cùng mật khẩu DEMO_PASSWORD. Không dùng dữ liệu mẫu này khi chạy thật.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = [
    { username: "quanly", fullName: "Quản lý", role: "MANAGER" },
    ...centers.map((c) => ({ username: `giaovu.${c.code.toLowerCase()}`, fullName: `Giáo vụ ${c.name}`, role: "OFFICE", centerId: c.id })),
    { username: "lan", fullName: T["Ms Lan"].fullName, role: "TEACHER", teacherId: T["Ms Lan"].id },
    { username: "thu", fullName: T["Thư"].fullName, role: "ASSISTANT", teacherId: T["Thư"].id },
  ];
  for (const u of users) await prisma.user.create({ data: { ...u, passwordHash } });

  const counts = await Promise.all([prisma.student.count(), prisma.parent.count(), prisma.teacher.count(), prisma.classSession.count()]);
  console.log(`Đã tạo: ${counts[0]} học sinh, ${counts[1]} phụ huynh, ${counts[2]} giáo viên, ${counts[3]} buổi học.`);
  console.log(`Tài khoản chạy thử (mật khẩu ${DEMO_PASSWORD}): ${users.map((u) => u.username).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
