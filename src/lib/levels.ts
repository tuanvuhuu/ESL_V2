/** B5: cấp độ dạy được của giáo viên, nhập dạng "Starters, Movers" (cách nhau bằng dấu phẩy hoặc chấm phẩy), so với `Course.level`. */

export type LevelMatch = "MATCH" | "MISMATCH" | "UNKNOWN";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Tách chuỗi cấp độ thành danh sách, bỏ trống và trùng. */
export function parseLevels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const v = part.trim();
    if (v && !out.some((o) => norm(o) === norm(v))) out.push(v);
  }
  return out;
}

/**
 * Giáo viên có dạy được cấp độ của khóa không.
 * - Chưa khai cấp độ dạy được, hoặc khóa chưa có cấp độ: UNKNOWN (không cộng, không trừ).
 * - Khai rồi: MATCH nếu có cấp độ của khóa trong danh sách, ngược lại MISMATCH.
 */
export function levelMatch(teachable: string | null | undefined, courseLevel: string | null | undefined): LevelMatch {
  const levels = parseLevels(teachable);
  if (levels.length === 0 || !courseLevel || !courseLevel.trim()) return "UNKNOWN";
  return levels.some((l) => norm(l) === norm(courseLevel)) ? "MATCH" : "MISMATCH";
}