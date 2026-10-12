import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      antd: path.resolve(__dirname, "src/client/primer-compat.tsx"),
      "@ant-design/icons": path.resolve(__dirname, "src/client/primer-icons.tsx"),
    };
    return config;
  },
};

export default nextConfig;
