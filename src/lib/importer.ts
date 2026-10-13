// Nhập học sinh đang học từ Excel / CSV (Tổng quan yêu cầu mục 6 "Chuyển dữ liệu", M15).
// Logic thuần: đọc CSV, nhận cột theo tiêu đề, chuẩn hóa và kiểm tra từng dòng.
// Phần đụng database (trung tâm, lớp, trùng hồ sơ) nằm ở src/server/importer.ts.
import { ageFrom, isValidISODate, todayISO } from "./dates";
import { isValidPhone, normalizePhone, normalizeVi } from "./text";

/** Cột của file mẫu, theo thứ tự. `aliases` là các tiêu đề khác vẫn nhận (không phân biệt dấu, hoa thường). */
export const IMPORT_COLUMNS = [
  { key: "fullName", header: "Họ tên học sinh", required: true, aliases: ["ho ten", "ho va ten", "ten hoc sinh", "hoc sinh"] },
  { key: "englishName", header: "Tên tiếng Anh", required: false, aliases: ["english name", "ten tieng anh"] },
  { key: "dob", header: "Ngày sinh", required: true, aliases: ["ngay sinh", "sinh ngay"] },
  { key: "gender", header: "Giới tính", required: false, aliases: ["gioi tinh"] },
  { key: "centerCode", header: "Mã trung tâm", required: true, aliases: ["trung tam", "ma tt", "co so"] },
  { key: "school", header: "Trường", required: false, aliases: ["truong"] },
  { key: "schoolGrade", header: "Lớp ở trường", required: false, aliases: ["lop o truong", "lop truong"] },
  { key: "level", header: "Trình độ", required: false, aliases: ["trinh do", "trinh do dau vao"] },
  { key: "parentName", header: "Tên phụ huynh", required: true, aliases: ["phu huynh", "ho ten phu huynh", "ten ph"] },
  { key: "parentPhone", header: "SĐT phụ huynh", required: true, aliases: ["sdt phu huynh", "so dien thoai", "sdt", "dien thoai"] },
  { key: "relation", header: "Quan hệ", required: false, aliases: ["quan he"] },
  { key: "classCode", header: "Mã lớp", required: false, aliases: ["lop", "ma lop", "lop dang hoc"] },
  { key: "remainingSessions", header: "Số buổi còn lại", required: false, aliases: ["so buoi con lai", "buoi con lai", "con lai"] },
  { key: "debt", header: "Còn nợ", required: false, aliases: ["con no", "cong no", "no hoc phi", "so tien con no"] },
  { key: "dueDate", header: "Hạn đóng", required: false, aliases: ["han dong", "han nop"] },
  { key: "note", header: "Ghi chú", required: false, aliases: ["ghi chu"] },
] as const;

export type ImportKey = (typeof IMPORT_COLUMNS)[number]["key"];
export type RawCell = string | number | boolean | Date | null | undefined;
export type RawRow = Partial<Record<ImportKey, RawCell>>;

/** Một dòng đã chuẩn hóa, sẵn sàng ghi vào database. */
export type ImportRow = {
  fullName: string;
  englishName: string | null;
  dob: string;
  gender: "MALE" | "FEMALE";
  audience: "KINDER" | "PRIMARY" | "SECONDARY" | "HIGH" | "ADULT";
  centerCode: string;
  school: string | null;
  schoolGrade: string | null;
  level: string | null;
  parentName: string;
  parentPhone: string;
  relation: string;
  classCode: string | null;
  remainingSessions: number | null;
  debt: number | null;
  dueDate: string | null;
  note: string | null;
};

const key = (s: string) => normalizeVi(s).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Vị trí từng cột trong dòng tiêu đề. Cột không nhận ra thì bỏ qua. */
export function mapHeader(header: RawCell[]): Partial<Record<ImportKey, number>> {
  const map: Partial<Record<ImportKey, number>> = {};
  header.forEach((h, i) => {
    const k = key(String(h ?? ""));
    if (!k) return;
    const col = IMPORT_COLUMNS.find((c) => key(c.header) === k || (c.aliases as readonly string[]).includes(k));
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

/** Cột bắt buộc chưa có trong dòng tiêu đề. */
export function missingColumns(map: Partial<Record<ImportKey, number>>): string[] {
  return IMPORT_COLUMNS.filter((c) => c.required && map[c.key] === undefined).map((c) => c.header);
}

/** Bảng (dòng đầu là tiêu đề) → các dòng dữ liệu theo cột; bỏ dòng trống. */
export function tableToRows(table: RawCell[][]): { rows: RawRow[]; missing: string[] } {
  const [header = [], ...body] = table;
  const map = mapHeader(header);
  const rows = body
    .filter((r) => r.some((c) => c != null && String(c).trim() !== ""))
    .map((r) => Object.fromEntries(Object.entries(map).map(([k, i]) => [k, r[i as number] ?? null])) as RawRow);
  return { rows, missing: missingColumns(map) };
}

/** Đọc CSV (dấu phẩy hoặc chấm phẩy, ngoặc kép, BOM của Excel). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const text = (v: RawCell) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());
const optional = (v: RawCell) => text(v) || null;

/** Ngày từ ô Excel: Date, số ngày kiểu Excel, "dd/mm/yyyy", "d-m-yyyy" hoặc "yyyy-mm-dd". */
export function parseDateCell(v: RawCell): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // Thư viện đọc Excel trả ngày lúc 00:00 giờ UTC; lấy theo UTC để không lệch một ngày.
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    if (v < 1 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let iso: string | null = null;
  if (m) iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return iso && isValidISODate(iso) ? iso : null;
}

/** Số từ ô: 1.500.000, 1,500,000, "1500000 ₫" đều thành 1500000. Trống → null, sai → NaN. */
export function parseNumberCell(v: RawCell): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[₫đ\s]/gi, "").replace(/[.,](?=\d{3}(\D|$))/g, "");
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function parseGender(v: RawCell): "MALE" | "FEMALE" | null {
  const k = key(text(v));
  if (["nam", "male", "m", "trai"].includes(k)) return "MALE";
  if (["nu", "female", "f", "gai"].includes(k)) return "FEMALE";
  return null;
}

/** Nhóm đối tượng theo tuổi khi file không có cột này. */
export function audienceForAge(age: number): ImportRow["audience"] {
  if (age < 6) return "KINDER";
  if (age < 11) return "PRIMARY";
  if (age < 15) return "SECONDARY";
  if (age < 18) return "HIGH";
  return "ADULT";
}

/** Chuẩn hóa và kiểm tra một dòng (chưa đụng database). */
export function validateRow(raw: RawRow, today = todayISO()): { row: ImportRow | null; errors: string[] } {
  const errors: string[] = [];
  const fullName = text(raw.fullName);
  if (!fullName) errors.push("Thiếu họ tên học sinh");
  const dob = parseDateCell(raw.dob ?? null);
  if (!dob) errors.push("Ngày sinh không đọc được (dùng dd/mm/yyyy)");
  else if (dob > today) errors.push("Ngày sinh ở tương lai");
  const genderText = text(raw.gender);
  const gender = genderText ? parseGender(genderText) : "MALE";
  if (!gender) errors.push(`Giới tính "${genderText}" không hiểu (Nam / Nữ)`);
  const centerCode = text(raw.centerCode).toUpperCase();
  if (!centerCode) errors.push("Thiếu mã trung tâm");
  const parentName = text(raw.parentName);
  if (!parentName) errors.push("Thiếu tên phụ huynh");
  // Excel hay bỏ số 0 đầu khi ô là kiểu số: 912345678 → 0912345678.
  const digits = normalizePhone(text(raw.parentPhone));
  const parentPhone = digits.length === 9 && !digits.startsWith("0") ? `0${digits}` : digits;
  if (!parentPhone) errors.push("Thiếu SĐT phụ huynh");
  else if (!isValidPhone(parentPhone)) errors.push(`SĐT phụ huynh "${text(raw.parentPhone)}" không hợp lệ`);
  const classCode = optional(raw.classCode)?.toUpperCase() ?? null;
  const remaining = parseNumberCell(raw.remainingSessions ?? null);
  if (remaining != null && (!Number.isInteger(remaining) || remaining < 0 || remaining > 300)) errors.push("Số buổi còn lại phải là số nguyên 0–300");
  if (remaining != null && !classCode) errors.push("Có số buổi còn lại thì cần mã lớp");
  const debt = parseNumberCell(raw.debt ?? null);
  if (debt != null && (!Number.isFinite(debt) || debt < 0)) errors.push("Số tiền còn nợ không hợp lệ");
  if (debt != null && debt > 0 && !classCode) errors.push("Có công nợ thì cần mã lớp để gắn vào ghi danh");
  const dueText = text(raw.dueDate);
  const dueDate = dueText ? parseDateCell(raw.dueDate ?? null) : null;
  if (dueText && !dueDate) errors.push("Hạn đóng không đọc được (dùng dd/mm/yyyy)");
  if (errors.length) return { row: null, errors };
  return {
    row: {
      fullName,
      englishName: optional(raw.englishName),
      dob: dob!,
      gender: gender!,
      audience: audienceForAge(ageFrom(dob!, today)),
      centerCode,
      school: optional(raw.school),
      schoolGrade: optional(raw.schoolGrade),
      level: optional(raw.level),
      parentName,
      parentPhone,
      relation: optional(raw.relation) ?? "Phụ huynh",
      classCode,
      remainingSessions: remaining,
      debt: debt ? Math.round(debt) : null,
      dueDate,
      note: optional(raw.note),
    },
    errors,
  };
}

/** Khóa so trùng học sinh: tên không dấu + ngày sinh. */
export const duplicateKey = (fullName: string, dob: string) => `${key(fullName)}|${dob}`;

/** Nội dung file mẫu (CSV, Excel mở được): tiêu đề + một dòng ví dụ. */
export function templateCsv(): string {
  const example = ["Nguyễn Minh An", "Andy", "15/03/2016", "Nam", "A", "TH Kim Đồng", "4A", "Movers", "Nguyễn Văn Bình", "0912345678", "Bố", "AL0001", "12", "1500000", "30/11/2026", ""];
  const esc = (s: string) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return "﻿" + [IMPORT_COLUMNS.map((c) => c.header), example].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
