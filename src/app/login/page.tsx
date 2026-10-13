"use client";

import { Alert, Button, Form, Input, Spin } from "@/client/primer-compat";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/client/api";

type Mode = "loading" | "login" | "setup";

/** Chỉ cho quay lại trang trong ứng dụng, không cho chuyển ra trang ngoài. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/auth/setup")
      .then((r) => setMode(r.needsSetup ? "setup" : "login"))
      .catch(() => setMode("login"));
  }, []);

  const submit = async (v: Record<string, string>) => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "setup") await api("/api/auth/setup", { body: { username: v.username, fullName: v.fullName, password: v.password } });
      else await api("/api/auth/login", { body: { username: v.username, password: v.password } });
      // Tải lại toàn trang để mọi dữ liệu được lấy theo tài khoản mới.
      window.location.assign(safeNext(params.get("next")));
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  if (mode === "loading") return <Spin />;

  return (
    <div className="panel" style={{ width: "100%", maxWidth: 400, padding: 32, boxShadow: "0 8px 24px rgba(31, 35, 40, 0.08)" }}>
      <span className="brand-mark" style={{ marginBottom: 16 }}>E</span>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>{mode === "setup" ? "Tạo tài khoản quản lý" : "Đăng nhập"}</h1>
      <p className="sub" style={{ marginTop: 0, marginBottom: 16 }}>
        {mode === "setup"
          ? "Hệ thống chưa có tài khoản nào. Tài khoản đầu tiên là quản lý, sau đó tạo tài khoản cho giáo vụ và giáo viên ở Cài đặt."
          : "Quản lý trung tâm tiếng Anh"}
      </p>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={submit} requiredMark={false} size="large">
        {mode === "setup" && (
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: "Nhập họ tên" }]}>
            <Input autoComplete="name" />
          </Form.Item>
        )}
        <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: "Nhập tên đăng nhập" }]}>
          <Input autoComplete="username" autoCapitalize="none" autoFocus />
        </Form.Item>
        <Form.Item
          name="password"
          label="Mật khẩu"
          rules={[{ required: true, message: "Nhập mật khẩu" }, ...(mode === "setup" ? [{ min: 8, message: "Tối thiểu 8 ký tự" }] : [])]}
        >
          <Input.Password autoComplete={mode === "setup" ? "new-password" : "current-password"} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={saving} style={{ height: 44 }}>
          {mode === "setup" ? "Tạo tài khoản và vào hệ thống" : "Đăng nhập"}
        </Button>
      </Form>
      {mode === "login" && <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>Quên mật khẩu: nhờ quản lý đặt lại ở Cài đặt › Tài khoản.</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "radial-gradient(1200px 600px at 10% -10%, var(--bgColor-accent-muted) 0%, transparent 60%), radial-gradient(900px 500px at 110% 110%, var(--bgColor-done-muted) 0%, transparent 55%), var(--bgColor-muted)" }}>
      <Suspense fallback={<Spin />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
