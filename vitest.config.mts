import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // Các file kiểm thử API dùng chung một database SQLite nên chạy lần lượt.
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: false },
});
