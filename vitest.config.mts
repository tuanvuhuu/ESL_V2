import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "antd": path.resolve(import.meta.dirname, "src/client/primer-compat.tsx"),
      "@ant-design/icons": path.resolve(import.meta.dirname, "src/client/primer-icons.tsx"),
    },
  },
  // Các file kiểm thử API dùng chung một database SQLite nên chạy lần lượt.
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: false },
});
