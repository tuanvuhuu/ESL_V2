/**
 * Màu trạng thái dùng chung, lấy từ token của Primer (@primer/primitives).
 * Không viết mã màu hex trong component: dùng các hằng ở đây hoặc var(--…) của Primer.
 * Màu trung tâm là ngoại lệ duy nhất (lưu trong database, người dùng tự chọn).
 */
export const COLORS = {
  accent: "var(--fgColor-accent)",
  success: "var(--fgColor-success)",
  attention: "var(--fgColor-attention)",
  danger: "var(--fgColor-danger)",
  done: "var(--fgColor-done)",
  neutral: "var(--fgColor-muted)",
  teal: "var(--display-teal-fgColor)",
} as const;

/** Nền/viền nhạt từ một màu bất kỳ (token Primer hoặc hex của trung tâm). */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
