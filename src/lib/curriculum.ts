// Khung chương trình theo buổi, tài liệu và điểm kiểm tra theo kỹ năng (Tổng quan yêu cầu mục 3.4, 3.6).
// Logic thuần, không đụng database: dùng chung cho màn hình, API và test.

/** Loại buổi kiểm tra. Buổi thường không có loại. */
export const TEST_KINDS = [
  { value: "QUIZ", label: "Kiểm tra nhỏ", color: "#0E7490" },
  { value: "MIDTERM", label: "Giữa khóa", color: "#D29922" },
  { value: "FINAL", label: "Cuối khóa", color: "#CF222E" },
] as const;

export type TestKind = (typeof TEST_KINDS)[number]["value"];

export const testKindOption = (v: string | null | undefined) => TEST_KINDS.find((o) => o.value === v);

/** Bốn kỹ năng chấm điểm, theo thứ tự hiển thị. */
export const SKILLS = [
  { key: "listening", label: "Nghe", short: "N" },
  { key: "speaking", label: "Nói", short: "Nói" },
  { key: "reading", label: "Đọc", short: "Đ" },
  { key: "writing", label: "Viết", short: "V" },
] as const;

export type SkillKey = (typeof SKILLS)[number]["key"];

export type SkillScores = Partial<Record<SkillKey, number | null>>;

export const MAX_SCORE = 10;

/** Làm tròn 1 chữ số thập phân: 7.25 → 7.3. */
export const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Điểm tổng: nhập tay thì giữ nguyên, không thì lấy trung bình các kỹ năng đã có điểm.
 * Không có kỹ năng nào thì trả về null.
 */
export function computeTotal(scores: SkillScores, manualTotal?: number | null): number | null {
  if (manualTotal != null) return round1(manualTotal);
  const values = SKILLS.map((s) => scores[s.key]).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Điểm hợp lệ: trống hoặc số từ 0 đến 10. */
export function isValidScore(v: unknown): boolean {
  return v == null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_SCORE);
}

export type Material = { name: string; url: string };

/** Đọc danh sách tài liệu lưu dạng JSON; dữ liệu hỏng thì coi như chưa có tài liệu. */
export function parseMaterials(raw: string | null | undefined): Material[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((m) => m && typeof m.url === "string" && m.url.trim())
      .map((m) => ({ name: typeof m.name === "string" && m.name.trim() ? m.name.trim() : m.url.trim(), url: m.url.trim() }));
  } catch {
    return [];
  }
}

export type LessonLite = { index: number; title: string; testKind: string | null };

/** Bài của buổi số `index` (buổi số N của lớp lấy bài số N của khóa). */
export function lessonForIndex<L extends LessonLite>(lessons: L[], index: number): L | null {
  return lessons.find((l) => l.index === index) ?? null;
}

/** Thêm các bài trống còn thiếu để khung đủ `total` buổi; không đụng bài đã có. */
export function fillLessons<L extends { index: number; title: string }>(lessons: L[], total: number, make: (index: number) => L): L[] {
  const have = new Set(lessons.map((l) => l.index));
  const added: L[] = [];
  for (let i = 1; i <= total; i++) if (!have.has(i)) added.push(make(i));
  return [...lessons, ...added].sort((a, b) => a.index - b.index);
}
