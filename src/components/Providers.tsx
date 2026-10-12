"use client";

import "@ant-design/v5-patch-for-react-19";
import { App, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CenterProvider } from "@/client/centers";
import { SessionProvider } from "@/client/session";
import { theme } from "@/client/theme";

dayjs.locale("vi");

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ConfigProvider locale={viVN} theme={theme}>
      <App message={{ top: 16, duration: 2.5 }}>
        <SessionProvider enabled={pathname !== "/login"}>
          <CenterProvider>{children}</CenterProvider>
        </SessionProvider>
      </App>
    </ConfigProvider>
  );
}
