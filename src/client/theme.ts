import type { ThemeConfig } from "antd";

// Design tokens theo DESIGN.md mục 3.
export const theme: ThemeConfig = {
  token: {
    colorPrimary: "#1F6FEB",
    colorSuccess: "#2DA44E",
    colorWarning: "#D29922",
    colorError: "#CF222E",
    colorInfo: "#1F6FEB",
    colorBgLayout: "#F6F8FA",
    colorText: "#1F2328",
    colorTextSecondary: "#59636E",
    borderRadius: 6,
    borderRadiusLG: 8,
    fontSize: 14,
    fontFamily: "'Be Vietnam Pro', Inter, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Table: { headerBg: "#FAFBFC", rowHoverBg: "#F3F7FF", borderColor: "#EEF1F4", cellPaddingBlock: 12, cellPaddingInline: 16 },
    Layout: { headerBg: "#FFFFFF", siderBg: "#FFFFFF" },
  },
};
