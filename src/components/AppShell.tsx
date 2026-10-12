"use client";

import {
  AppstoreOutlined,
  CalendarOutlined,
  DownOutlined,
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
import { AutoComplete, Avatar, Button, Drawer, Dropdown, Grid, Input, Layout, Menu, Result, Select, Spin } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, qs, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useSession } from "@/client/session";
import { canOpenPage, canSeeAllCenters, isStaff, roleLabel, type Viewer } from "@/lib/permissions";
import { formatPhone, initials } from "@/lib/text";
import { ChangePasswordModal } from "./ChangePasswordModal";

type NavItem = { key: string; icon: ReactNode; label: string };
type NavGroup = { key: string; label: string; items: NavItem[] };

/** Menu chia nhóm theo công việc hằng ngày; nhóm không còn mục nào thì ẩn. */
const NAV: NavGroup[] = [
  { key: "today", label: "Tổng quan", items: [{ key: "/", icon: <HomeOutlined />, label: "Hôm nay" }] },
  {
    key: "teaching",
    label: "Đào tạo",
    items: [
      { key: "/schedule", icon: <CalendarOutlined />, label: "Lịch học" },
      { key: "/classes", icon: <ReadOutlined />, label: "Lớp học" },
    ],
  },
  {
    key: "people",
    label: "Con người",
    items: [
      { key: "/students", icon: <UserOutlined />, label: "Học sinh" },
      { key: "/parents", icon: <TeamOutlined />, label: "Phụ huynh" },
      { key: "/teachers", icon: <SolutionOutlined />, label: "Giáo viên" },
    ],
  },
  { key: "system", label: "Hệ thống", items: [{ key: "/settings", icon: <SettingOutlined />, label: "Cài đặt" }] },
];

/** Menu theo vai trò: mục không có quyền thì ẩn hẳn (DESIGN mục 7). */
function navFor(v: Viewer): NavGroup[] {
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((n) => canOpenPage(v, n.key)) }));
  if (isStaff(v) && v.teacherId) {
    // Giáo viên, trợ giảng: hồ sơ và lịch dạy của mình.
    groups.push({ key: "me", label: "Cá nhân", items: [{ key: `/teachers/${v.teacherId}`, icon: <IdcardOutlined />, label: "Của tôi" }] });
  }
  return groups.filter((g) => g.items.length > 0);
}

function isActive(key: string, pathname: string) {
  return key === "/" ? pathname === "/" : pathname === key || pathname.startsWith(`${key}/`);
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={`brand${collapsed ? " collapsed" : ""}`}>
      <span className="brand-mark">E</span>
      {!collapsed && (
        <span className="brand-text">
          <b>ESL Center</b>
          <span>Trung tâm tiếng Anh</span>
        </span>
      )}
    </div>
  );
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
        <Button type="text" className="user-btn" aria-label="Tài khoản">
          <Avatar size={32} style={{ background: "#1F6FEB", flexShrink: 0 }}>{initials(viewer.fullName)}</Avatar>
          {!compact && (
            <span className="user-btn-text">
              <b>{viewer.fullName}</b>
              <span>{roleLabel(viewer.role)}</span>
            </span>
          )}
          {!compact && <DownOutlined style={{ fontSize: 10, color: "#8C959F" }} />}
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
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  if (!viewer) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  const groups = navFor(viewer);
  const flat = groups.flatMap((g) => g.items);
  const selected = flat.filter((n) => isActive(n.key, pathname)).map((n) => n.key);
  const toMenu = (n: NavItem) => ({ key: n.key, icon: n.icon, label: <Link href={n.key}>{n.label}</Link> });
  // Thu gọn thì nhãn nhóm không hiện được, thay bằng đường kẻ mảnh giữa các nhóm.
  const menuItems = collapsed
    ? groups.flatMap((g, i) => [...(i ? [{ type: "divider" as const, key: `d-${g.key}` }] : []), ...g.items.map(toMenu)])
    : groups.map((g) => ({ type: "group" as const, key: g.key, label: g.label, children: g.items.map(toMenu) }));
  const allowed = canOpenPage(viewer, pathname);
  // Di động: 4 mục đầu ở thanh dưới, phần còn lại trong "Thêm".
  const bottom = flat.length > 5 ? flat.slice(0, 4) : flat;
  const moreActive = flat.length > 5 && !bottom.some((n) => selected.includes(n.key));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Layout.Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="xl"
          width={232}
          collapsedWidth={72}
          theme="light"
          className="sider"
        >
          <Brand collapsed={collapsed} />
          <Menu mode="inline" selectedKeys={selected} items={menuItems} className="side-menu" />
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
            {bottom.map((n) => (
              <Link key={n.key} href={n.key} className={selected.includes(n.key) ? "active" : ""}>
                {n.icon}
                <span>{n.label}</span>
              </Link>
            ))}
            {flat.length > 5 && (
              <button type="button" className={moreActive ? "active" : ""} onClick={() => setMoreOpen(true)}>
                <AppstoreOutlined />
                <span>Thêm</span>
              </button>
            )}
          </nav>
        )}
        {isMobile && (
          <Drawer placement="bottom" height="auto" open={moreOpen} onClose={() => setMoreOpen(false)} title="Tất cả mục" className="more-drawer">
            {groups.map((g) => (
              <div key={g.key} className="more-group">
                <div className="more-group-label">{g.label}</div>
                <div className="more-grid">
                  {g.items.map((n) => (
                    <Link key={n.key} href={n.key} onClick={() => setMoreOpen(false)} className={selected.includes(n.key) ? "active" : ""}>
                      {n.icon}
                      <span>{n.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </Drawer>
        )}
      </Layout>
    </Layout>
  );
}
