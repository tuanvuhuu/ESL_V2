"use client";

import { useEffect } from "react";
import { Button, Result } from "antd";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ghi log lỗi để hỗ trợ debug
    console.error("Next.js App Error:", error);
  }, [error]);

  return (
    <div style={{ minHeight: "80vh", display: "grid", placeItems: "center", padding: 24 }}>
      <Result
        status="error"
        title="Đã xảy ra sự cố hiển thị"
        subTitle={error?.message || "Hệ thống gặp lỗi trong quá trình tải thành phần giao diện."}
        extra={[
          <Button type="primary" key="retry" onClick={() => reset()}>
            Thử tải lại
          </Button>,
          <Button key="home" onClick={() => (window.location.href = "/")}>
            Về trang chủ
          </Button>,
        ]}
      />
    </div>
  );
}
