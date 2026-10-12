"use client";

import "@ant-design/v5-patch-for-react-19";
import { App, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import type { ReactNode } from "react";
import { CenterProvider } from "@/client/centers";
import { theme } from "@/client/theme";

dayjs.locale("vi");

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={viVN} theme={theme}>
      <App message={{ top: 16, duration: 2.5 }}>
        <CenterProvider>{children}</CenterProvider>
      </App>
    </ConfigProvider>
  );
}
