"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Global Root Error:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          background: "var(--bgColor-muted)",
        }}
      >
        <div
          style={{
            background: "var(--bgColor-default)",
            padding: 32,
            borderRadius: 8,
            border: "1px solid var(--borderColor-default)",
            boxShadow: "0 8px 24px rgba(31, 35, 40, 0.08)",
            textAlign: "center",
            maxWidth: 480,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ color: "var(--fgColor-danger)", margin: "0 0 8px" }}>Lỗi hệ thống toàn cục</h2>
          <p style={{ color: "var(--fgColor-muted)", fontSize: 14, marginBottom: 20 }}>
            {error?.message || "Không thể khởi tạo giao diện chính của ứng dụng."}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 20px",
              background: "var(--bgColor-accent-emphasis)",
              color: "var(--fgColor-onEmphasis)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Tải lại ứng dụng
          </button>
        </div>
      </body>
    </html>
  );
}
