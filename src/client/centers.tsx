"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useApi } from "./api";
import type { Center } from "./types";

type Ctx = {
  centers: Center[];
  /** 0 = tất cả trung tâm */
  centerId: number;
  setCenterId: (id: number) => void;
  reloadCenters: () => Promise<void>;
  centerById: (id: number | null | undefined) => Center | undefined;
};

const CenterContext = createContext<Ctx | null>(null);
const KEY = "esl.centerId";

export function CenterProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useApi<Center[]>("/api/centers");
  const [centerId, setCenterIdState] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved) setCenterIdState(saved);
    } catch {
      /* trình duyệt chặn lưu trữ */
    }
  }, []);

  const setCenterId = (id: number) => {
    setCenterIdState(id);
    try {
      localStorage.setItem(KEY, String(id));
    } catch {
      /* bỏ qua */
    }
  };

  const centers = data ?? [];
  return (
    <CenterContext.Provider
      value={{
        centers,
        centerId,
        setCenterId,
        reloadCenters: reload,
        centerById: (id) => centers.find((c) => c.id === id),
      }}
    >
      {children}
    </CenterContext.Provider>
  );
}

export function useCenters() {
  const ctx = useContext(CenterContext);
  if (!ctx) throw new Error("useCenters phải nằm trong CenterProvider");
  return ctx;
}
