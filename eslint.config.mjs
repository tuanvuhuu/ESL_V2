import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Giao diện một nguồn (DESIGN.md mục 2): màn hình lấy component từ bộ kit @/client/primer-compat,
  // icon từ @/client/primer-icons, màu từ token Primer. Chỉ các file của bộ kit được gọi thẳng Primer.
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    ignores: [
      "src/components/AppShell.tsx",
      "src/components/PrimerGrid.tsx",
      "src/components/PrimerModal.tsx",
      "src/components/Providers.tsx",
      "src/components/ui.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@primer/react", message: "Lấy component từ @/client/primer-compat (bộ kit chung)." },
            { name: "@primer/react/experimental", message: "Lấy component từ @/client/primer-compat (bộ kit chung)." },
            { name: "antd", message: "Dự án dùng Primer React, không dùng Ant Design." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.tsx", "src/lib/**/*.ts"],
    ignores: ["src/lib/colors.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9A-Fa-f]{6}\\b|#[0-9A-Fa-f]{3}\\b/]",
          message: "Không viết mã màu hex: dùng token Primer var(--fgColor-…) hoặc COLORS trong @/lib/colors.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9A-Fa-f]{6}\\b/]",
          message: "Không viết mã màu hex: dùng token Primer var(--fgColor-…) hoặc COLORS trong @/lib/colors.",
        },
      ],
    },
  },
];

export default config;
