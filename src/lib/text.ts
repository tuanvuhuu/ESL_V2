// Tiện ích chữ: bỏ dấu tiếng Việt, chuẩn hoá SĐT, định dạng hiển thị.

export function normalizeVi(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Ghép các trường thành chuỗi tìm kiếm không dấu; SĐT thêm cả dạng liền số. */
export function buildSearchText(parts: (string | null | undefined)[]): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    out.push(normalizeVi(p));
    const digits = p.replace(/\D/g, "");
    if (digits.length >= 3 && digits !== p) out.push(digits);
  }
  return out.join(" | ");
}

/** Chuỗi truy vấn: bỏ dấu; nếu toàn số và dấu cách thì bỏ dấu cách để khớp SĐT. */
export function normalizeQuery(q: string): string {
  const trimmed = q.trim();
  if (/^[\d\s.]+$/.test(trimmed)) return trimmed.replace(/\D/g, "");
  return normalizeVi(trimmed);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidPhone(phone: string): boolean {
  return /^0\d{9}$/.test(normalizePhone(phone));
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const d = normalizePhone(phone);
  if (d.length !== 10) return phone;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1]?.[0] ?? "?").toUpperCase();
}

export function formatCode(prefix: string, id: number, width = 6): string {
  return `${prefix}${String(id).padStart(width, "0")}`;
}

export function formatMoney(v: number): string {
  return `${v.toLocaleString("vi-VN")} ₫`;
}
