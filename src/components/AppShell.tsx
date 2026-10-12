"use client";

import {
  CalendarOutlined,
  HomeOutlined,
  IdcardOutlined,
  KeyOutlined,
  LogoutOutlined,
  ReadOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { AutoComplete, Avatar, Button, Dropdown, Grid, Input, Layout, Menu, Result, Select, Spin } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { api, qs, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useSession } from "@/client/session";
import { canOpenPage, canSeeAllCenters, isStaff, roleLabel, type Viewer } from "@/lib/permissions";
import { formatPhone, initials } from "@/lib/text";
import { useEffect } from "react";
import { ChangePasswordModal } from "./ChangePasswordModal";

const NAV = [
  { key: "/", icon: <HomeOutlined />, label: "Hôm nay" },
  { key: "/schedule", icon: <CalendarOutlined />, label: "Lịch học" },
  { key: "/classes", icon: <ReadOutlined />, label: "Lớp học" },
  { key: "/students", icon: <UserOutlined />, label: "Học sinh" },
  { key: "/parents", icon: <TeamOutlined />, label: "Phụ huynh" },
  { key: "/teachers", icon: <SolutionOutlined />, label: "Giáo viên" },
  { key: "/settings", icon: <SettingOutlined />, label: "Cài đặt" },
];

/** Menu theo vai trò: mục không có quyền thì ẩn hẳn (DESIGN mục 7). */
function navFor(v: Viewer) {
  const items = NAV.filter((n) => canOpenPage(v, n.key));
  if (isStaff(v) && v.teacherId) {
    // Giáo viên, trợ giảng: thay "Giáo viên" bằng hồ sơ và lịch dạy của mình.
    items.splice(items.length, 0, { key: `/teachers/${v.teacherId}`, icon: <IdcardOutlined />, label: "Của tôi" });
  }
  return items;
}

function UserMenu({ viewer, compact }: { viewer: Viewer; compact: boolean }) {
  const { logout } = useSession();
  const [changing, setChanging] = useState(false);
  return (
    <>
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            { key: "who", disabled: true, label: <div><b>{viewer.fullName}</b><div className="sub">{roleLabel(viewer.role)} · {viewer.username}</div></div> },
            { type: "divider" },
            { key: "password", icon: <KeyOutlined />, label: "Đổi mật khẩu", onClick: () => setChanging(true) },
            { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", danger: true, onClick: () => void logout() },
          ],
        }}
      >
        <Button type="text" style={{ height: 40, paddingInline: 4, flexShrink: 0 }} aria-label="Tài khoản">
          <Avatar size={32} style={{ background: "#1F6FEB" }}>{initials(viewer.fullName)}</Avatar>
          {!compact && <span style={{ marginInlineStart: 8 }}>{viewer.fullName}</span>}
        </Button>
      </Dropdown>
      <ChangePasswordModal open={changing} onClose={() => setChanging(false)} />
    </>
  );
}

type SearchResult = {
  students: { id: number; code: string; fullName: string; englishName: string | null; center: { name: string } }[];
  parents: { id: number; fullName: string; phone: string }[];
  teachers: { id: number; code: string; displayName: string }[];
};

function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [res, setRes] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setRes(null);
      return;
    }
    let alive = true;
    api<SearchResult>(`/api/search${qs({ q: dq })}`)
      .then((r) => alive && setRes(r))
      .catch(() => alive && setRes(null));
    return () => {
      alive = false;
    };
  }, [dq]);

  const options = useMemo(() => {
    if (!res) return [];
    const groups = [];
    if (res.students.length)
      groups.push({
        label: "Học sinh",
        options: res.students.map((s) => ({
          value: `/students/${s.id}`,
          label: `${s.fullName}${s.englishName ? ` (${s.englishName})` : ""} · ${s.code} · ${s.center.name}`,
        })),
      });
    if (res.parents.length)
      groups.push({
        label: "Phụ huynh",
        options: res.parents.map((p) => ({ value: `/parents/${p.id}`, label: `${p.fullName} · ${formatPhone(p.phone)}` })),
      });
    if (res.teachers.length)
      groups.push({
        label: "Giáo viên",
        options: res.teachers.map((t) => ({ value: `/teachers/${t.id}`, label: `${t.displayName} · ${t.code}` })),
      });
    return groups;
  }, [res]);

  return (
    <AutoComplete
      style={{ width: "100%", maxWidth: 420 }}
      options={options}
      value={q}
      onChange={setQ}
      onSelect={(v: string) => {
        setQ("");
        router.push(v);
      }}
      notFoundContent={dq.trim().length >= 2 ? "Không tìm thấy" : null}
    >
      <Input.Search placeholder={placeholder} allowClear />
    </AutoComplete>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  return <SignedInShell>{children}</SignedInShell>;
}

function SignedInShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { viewer } = useSession();
  const { centers, centerId, setCenterId } = useCenters();

  if (!viewer) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  const nav = navFor(viewer);
  const selected = nav.filter((n) => (n.key === "/" ? pathname === "/" : pathname.startsWith(n.key))).map((n) => n.key);
  const menuItems = nav.map((n) => ({ key: n.key, icon: n.icon, label: <Link href={n.key}>{n.label}</Link> }));
  const allowed = canOpenPage(viewer, pathname);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Layout.Sider collapsible breakpoint="xl" width={200} theme="light" style={{ borderRight: "1px solid #EEF1F4" }}>
          <div className="logo">ESL</div>
          <Menu mode="inline" selectedKeys={selected} items={menuItems} style={{ borderInlineEnd: 0 }} />
        </Layout.Sider>
      )}
      <Layout>
        <Layout.Header className="topbar">
          {!isStaff(viewer) && (
          <Select
            value={canSeeAllCenters(viewer) ? centerId : centerId || undefined}
            placeholder="Trung tâm"
            onChange={setCenterId}
            style={{ width: isMobile ? 130 : 190 }}
            options={[
              ...(canSeeAllCenters(viewer) ? [{ value: 0, label: "Tất cả trung tâm" }] : []),
              ...centers.map((c) => ({
                value: c.id,
                label: (
                  <span>
                    <span className="dot" style={{ background: c.color }} />
                    {c.name}
                  </span>
                ),
              })),
            ]}
          />
          )}
          <GlobalSearch placeholder={isStaff(viewer) ? "Tìm học sinh lớp mình" : "Tìm HS / PH / GV, tên hoặc SĐT"} />
          <div style={{ flex: 1 }} />
          <UserMenu viewer={viewer} compact={isMobile} />
        </Layout.Header>
        <Layout.Content className="content" style={{ paddingBottom: isMobile ? 72 : 24 }}>
          {allowed ? children : <Result status="403" title="Không có quyền" subTitle="Tài khoản của bạn không mở được trang này." extra={<Link href="/">Về trang Hôm nay</Link>} />}
        </Layout.Content>
        {isMobile && (
          <nav className="bottom-nav">
            {nav.slice(0, 5).map((n) => (
              <Link key={n.key} href={n.key} className={selected.includes(n.key) ? "active" : ""}>
                {n.icon}
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>
        )}
      </Layout>
    </Layout>
  );
}
