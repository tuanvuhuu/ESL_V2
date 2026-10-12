"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Viewer } from "@/lib/permissions";
import { api, useApi } from "./api";

type Ctx = {
  /** Người đang đăng nhập; undefined khi đang tải. */
  viewer: Viewer | undefined;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { data, reload } = useApi<Viewer>(enabled ? "/api/auth/me" : null);
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login");
  };
  return <SessionContext.Provider value={{ viewer: data, reload, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession phải nằm trong SessionProvider");
  return ctx;
}

/** Người đang đăng nhập (chỉ dùng trong trang đã đăng nhập: AppShell chờ tải xong mới hiện trang). */
export function useViewer(): Viewer {
  const { viewer } = useSession();
  if (!viewer) throw new Error("Chưa tải xong thông tin đăng nhập");
  return viewer;
}
