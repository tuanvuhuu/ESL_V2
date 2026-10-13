// Nhập học sinh từ Excel: kiểm tra với database (trung tâm, lớp, trùng hồ sơ, quyền) rồi ghi các dòng hợp lệ.
import type { Prisma } from "@prisma/client";
import { addDays, todayISO } from "@/lib/dates";
import { duplicateKey, validateRow, type ImportRow, type RawRow } from "@/lib/importer";
import { canEditCenter, type Viewer } from "@/lib/permissions";
import { formatCode } from "@/lib/text";
import { logChange } from "./audit";
import { prisma } from "./db";
import { createEnrollment } from "./enrollments";
import { HttpError } from "./http";
import { refreshParentSearch } from "./search-text";

type Tx = Prisma.TransactionClient | typeof prisma;

export type CheckedRow = {
  /** Số dòng trong file (dòng 1 là tiêu đề). */
  line: number;
  fullName: string;
  row: ImportRow | null;
  errors: string[];
  /** Ghi chú không chặn: dùng lại phụ huynh có sẵn… */
  notes: string[];
};

/** Kiểm tra từng dòng; không ghi gì. */
export async function checkImport(tx: Tx, raws: RawRow[], viewer: Viewer): Promise<CheckedRow[]> {
  const [centers, classes, students, parents] = await Promise.all([
    tx.center.findMany({ select: { id: true, code: true } }),
    tx.classGroup.findMany({ select: { code: true, centerId: true, status: true } }),
    tx.student.findMany({ select: { fullName: true, dob: true, code: true } }),
    tx.parent.findMany({ select: { phone: true, fullName: true } }),
  ]);
  const centerByCode = new Map(centers.map((c) => [c.code.toUpperCase(), c]));
  const classByCode = new Map(classes.map((c) => [c.code.toUpperCase(), c]));
  const existing = new Map(students.map((s) => [duplicateKey(s.fullName, s.dob), s.code]));
  const parentByPhone = new Map(parents.map((p) => [p.phone, p.fullName]));
  const seen = new Map<string, number>();

  return raws.map((raw, i) => {
    const line = i + 2;
    const { row, errors } = validateRow(raw);
    const notes: string[] = [];
    if (row) {
      const center = centerByCode.get(row.centerCode);
      if (!center) errors.push(`Không có trung tâm mã "${row.centerCode}"`);
      else if (!canEditCenter(viewer, center.id)) errors.push("Bạn chỉ nhập được học sinh của trung tâm mình");
      if (row.classCode) {
        const cls = classByCode.get(row.classCode);
        if (!cls) errors.push(`Không có lớp mã "${row.classCode}"`);
        else if (cls.status === "FINISHED" || cls.status === "CANCELLED") errors.push(`Lớp ${row.classCode} đã kết thúc hoặc đã hủy`);
        else if (center && cls.centerId !== center.id) notes.push(`Lớp ${row.classCode} ở trung tâm khác trung tâm chính`);
      }
      const dup = duplicateKey(row.fullName, row.dob);
      if (existing.has(dup)) errors.push(`Đã có học sinh cùng tên và ngày sinh (${existing.get(dup)})`);
      if (seen.has(dup)) errors.push(`Trùng với dòng ${seen.get(dup)} trong file`);
      else seen.set(dup, line);
      if (parentByPhone.has(row.parentPhone)) notes.push(`Dùng lại phụ huynh ${parentByPhone.get(row.parentPhone)} (cùng SĐT)`);
    }
    return { line, fullName: row?.fullName ?? String(raw.fullName ?? ""), row: errors.length ? null : row, errors, notes };
  });
}

/**
 * Ghi các dòng hợp lệ trong một giao dịch: tạo học sinh (đang học nếu có lớp, chờ xếp lớp nếu không),
 * phụ huynh (dùng lại nếu trùng SĐT), ghi danh từ hôm nay với số buổi đã mua = số buổi còn lại,
 * học phí của ghi danh = số tiền còn nợ để hiện trong Công nợ.
 */
export async function runImport(raws: RawRow[], viewer: Viewer) {
  return prisma.$transaction(
    async (tx) => {
      const checked = await checkImport(tx, raws, viewer);
      const valid = checked.filter((c) => c.row);
      if (valid.length === 0) return { created: 0, skipped: checked.length, checked };
      const centers = new Map((await tx.center.findMany({ select: { id: true, code: true } })).map((c) => [c.code.toUpperCase(), c.id]));
      const classes = new Map((await tx.classGroup.findMany({ select: { id: true, code: true } })).map((c) => [c.code.toUpperCase(), c.id]));
      const today = todayISO();
      for (const c of valid) {
        const r = c.row!;
        try {
          const parent =
            (await tx.parent.findUnique({ where: { phone: r.parentPhone } })) ??
            (await tx.parent.create({ data: { fullName: r.parentName, phone: r.parentPhone } }));
          const created = await tx.student.create({
            data: {
              code: `TMP-${Date.now()}-${Math.random()}`,
              fullName: r.fullName,
              englishName: r.englishName,
              dob: r.dob,
              gender: r.gender,
              audience: r.audience,
              school: r.school,
              schoolGrade: r.schoolGrade,
              centerId: centers.get(r.centerCode)!,
              level: r.level,
              status: r.classCode ? "STUDYING" : "WAITING",
              note: r.note,
            },
          });
          const s = await tx.student.update({ where: { id: created.id }, data: { code: formatCode("HS", created.id) } });
          await tx.studentGuardian.create({
            data: { studentId: s.id, parentId: parent.id, relation: r.relation, isPrimary: true, isPayer: true },
          });
          if (r.classCode) {
            await createEnrollment(tx, {
              classId: classes.get(r.classCode)!,
              studentId: s.id,
              joinedAt: today,
              purchasedSessions: r.remainingSessions ?? undefined,
              adjustmentNote: "Chuyển từ dữ liệu cũ (Excel)",
              tuitionFee: r.debt ?? 0,
              dueDate: r.debt ? (r.dueDate ?? addDays(today, 7)) : null,
            });
          }
          await refreshParentSearch(tx, parent.id);
          await logChange(tx, "Student", s.id, "import", {
            fullName: [null, s.fullName],
            ...(r.classCode ? { class: [null, r.classCode], purchasedSessions: [null, r.remainingSessions] } : {}),
            ...(r.debt ? { tuitionFee: [null, r.debt] } : {}),
          });
        } catch (e) {
          // Một dòng lỗi (lớp đủ chỗ, trùng giờ…) thì hủy cả lần nhập để không nhập dở dang.
          const msg = e instanceof HttpError ? e.message : "Lỗi không xác định";
          throw new HttpError(409, `Dòng ${c.line} (${r.fullName}): ${msg}. Chưa nhập dòng nào, sửa file rồi nhập lại.`);
        }
      }
      return { created: valid.length, skipped: checked.length - valid.length, checked };
    },
    { timeout: 60_000 },
  );
}
