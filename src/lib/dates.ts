// Ngày dạng "YYYY-MM-DD", giờ dạng "HH:mm". Tính toán theo lịch, không theo múi giờ.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s: string, days: number): string {
  const d = parseISODate(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** 1 = Thứ 2 … 7 = Chủ nhật */
export function isoWeekday(s: string): number {
  const wd = parseISODate(s).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function startOfWeek(s: string): string {
  return addDays(s, 1 - isoWeekday(s));
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISODate(parseISODate(s)) === s;
}

const WD_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** "T2, 12/10/2026" */
export function formatDateVN(s: string, withWeekday = false): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  const base = `${d}/${m}/${y}`;
  return withWeekday ? `${WD_SHORT[isoWeekday(s)]}, ${base}` : base;
}

export function todayISO(): string {
  // Giờ Việt Nam (UTC+7).
  return toISODate(new Date(Date.now() + 7 * 3600 * 1000));
}

export function ageFrom(dob: string, today = todayISO()): number {
  const [y1, m1, d1] = dob.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  let age = y2 - y1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) age--;
  return age;
}
