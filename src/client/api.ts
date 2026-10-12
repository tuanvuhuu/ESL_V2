"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/auth/") && typeof window !== "undefined") {
    // Phiên hết hạn hoặc bị đăng xuất: về trang đăng nhập rồi quay lại trang đang xem.
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Có lỗi xảy ra", data?.details);
  return data as T;
}

api.get = <T = unknown>(url: string) => api<T>(url);
api.post = <T = unknown>(url: string, body?: unknown) => api<T>(url, { method: "POST", body });
api.put = <T = unknown>(url: string, body?: unknown) => api<T>(url, { method: "PUT", body });
api.delete = <T = unknown>(url: string) => api<T>(url, { method: "DELETE" });

export function qs(params: Record<string, string | number | undefined | null | false>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false && v !== 0) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Tải dữ liệu theo URL; đổi URL thì tải lại; `reload()` để tải lại sau khi lưu. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!!url);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(url);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(e as Error);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
