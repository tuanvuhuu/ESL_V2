"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { canEditCenter, canSeeAllCenters, isOffice, isStaff } from "@/lib/permissions";
import { useApi } from "./api";
import { useSession } from "./session";
import type { Center } from "./types";

type Ctx = {
  centers: Center[];
  /** Trung tâm người đăng nhập được thêm / sửa dữ liệu. */
  editableCenters: Center[];
  /** Trung tâm mặc định khi thêm mới: trung tâm đang chọn nếu sửa được, không thì trung tâm sửa được đầu tiên. */
  defaultEditableCenterId: number | undefined;
  /** 0 = tất cả trung tâm */
  centerId: number;
  setCenterId: (id: number) => void;
  reloadCenters: () => Promise<void>;
  centerById: (id: number | null | undefined) => Center | undefined;
};

const CenterContext = createContext<Ctx | null>(null);
const KEY = "esl.centerId";

export function CenterProvider({ children }: { children: ReactNode }) {
  const { viewer } = useSession();
  const { data, reload } = useApi<Center[]>(viewer ? "/api/centers" : null);
  const [centerId, setCenterIdState] = useState(0);

  // Quản lý: nhớ lựa chọn lần trước. Giáo vụ: mặc định trung tâm mình.
  // Giáo viên, trợ giảng: luôn "tất cả" vì server đã lọc theo lớp của họ.
  useEffect(() => {
    if (!viewer) return;
    if (isStaff(viewer)) return setCenterIdState(0);
    if (isOffice(viewer)) return setCenterIdState(viewer.centerId ?? 0);
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved && canSeeAllCenters(viewer)) setCenterIdState(saved);
    } catch {
      /* trình duyệt chặn lưu trữ */
    }
  }, [viewer]);

  const setCenterId = (id: number) => {
    setCenterIdState(id);
    if (!viewer || !canSeeAllCenters(viewer)) return;
    try {
      localStorage.setItem(KEY, String(id));
    } catch {
      /* bỏ qua */
    }
  };

  const centers = data ?? [];
  const editableCenters = viewer ? centers.filter((c) => canEditCenter(viewer, c.id)) : [];
  return (
    <CenterContext.Provider
      value={{
        centers,
        editableCenters,
        defaultEditableCenterId: (editableCenters.find((c) => c.id === centerId) ?? editableCenters[0])?.id,
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
