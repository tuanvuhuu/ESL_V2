"use client";

import "@primer/primitives/dist/css/primitives.css";
import "@primer/primitives/dist/css/functional/themes/light.css";
import { BaseStyles, ThemeProvider } from "@primer/react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CenterProvider } from "@/client/centers";
import { SessionProvider } from "@/client/session";
import { ToastContainer } from "@/client/toast";

dayjs.locale("vi");

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ThemeProvider colorMode="light">
      <BaseStyles>
        <SessionProvider enabled={Boolean(pathname && pathname !== "/login")}>
          <CenterProvider>
            {children}
            <ToastContainer />
          </CenterProvider>
        </SessionProvider>
      </BaseStyles>
    </ThemeProvider>
  );
}
