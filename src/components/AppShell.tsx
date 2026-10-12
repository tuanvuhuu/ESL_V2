"use client";

import {
  AccountBookOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  ControlOutlined,
  DollarOutlined,
  DownOutlined,
  FileTextOutlined,
  HomeOutlined,
  IdcardOutlined,
  KeyOutlined,
  LogoutOutlined,
  PhoneOutlined,
  ReadOutlined,
  ScheduleOutlined,
  SearchOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { ActionMenu as PrimerActionMenu, ActionList, Breadcrumbs as PrimerBreadcrumbs } from "@primer/react";
import { AutoComplete, Avatar, Button, Drawer, Dropdown, Grid, Input, Layout, Menu, Result, Select, Spin } from "antd";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, qs, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import { useSession } from "@/client/session";
import { canOpenPage, canSeeAllCenters, isStaff, roleLabel, type Viewer } from "@/lib/permissions";
import { formatPhone, initials } from "@/lib/text";
import { ChangePasswordModal } from "./ChangePasswordModal";

type NavLeaf = { key: string; label: string };
type NavItem = { key: string; icon: ReactNode; label: string; children?: NavLeaf[] };
/** `single`: nhóm chỉ có một mục, hiện thẳng mục đó ở cấp 1. */
type NavGroup = { key: string; label: string; icon: ReactNode; single?: boolean; items: NavItem[] };

/** Các tab của trang Cài đặt, dùng chung cho menu cấp 3 và trang Cài đặt. */
export const SETTINGS_TABS = [
  { key: "centers", label: "Trung tâm & phòng" },
  { key: "holidays", label: "Ngày nghỉ lễ" },
  { key: "courses", label: "Khóa học" },
  { key: "users", label: "Tài khoản" },
] as const;

/** Menu nhiều cấp: nhóm (cấp 1) › trang (cấp 2) › mục con (cấp 3). Nhóm không còn mục nào thì ẩn. */
const NAV: NavGroup[] = [
  { key: "today", label: "Tổng quan", icon: <HomeOutlined />, single: true, items: [{ key: "/", icon: <HomeOutlined />, label: "Hôm nay" }] },
  {
    key: "teaching",
    label: "Đào tạo",
    icon: <BookOutlined />,
    items: [
      { key: "/schedule", icon: <CalendarOutlined />, label: "Lịch học" },
      { key: "/classes", icon: <ReadOutlined />, label: "Lớp học" },
      { key: "/makeups", icon: <ScheduleOutlined />, label: "Học bù" },
    ],
  },
  {
    key: "people",
    label: "Con người",
    icon: <TeamOutlined />,
    items: [
      { key: "/students", icon: <UserOutlined />, label: "Học sinh" },
      { key: "/parents", icon: <UsergroupAddOutlined />, label: "Phụ huynh" },
      { key: "/followups", icon: <PhoneOutlined />, label: "Cần gọi lại" },
      { key: "/teachers", icon: <SolutionOutlined />, label: "Giáo viên" },
    ],
  },
  {
    key: "finance",
    label: "Tài chính",
    icon: <DollarOutlined />,
    items: [
      { key: "/finance", icon: <FileTextOutlined />, label: "Thu học phí" },
      { key: "/finance/debts", icon: <WalletOutlined />, label: "Công nợ" },
      { key: "/finance/expenses", icon: <AccountBookOutlined />, label: "Chi phí" },
    ],
  },
  {
    key: "payroll",
    label: "Lương",
    icon: <AccountBookOutlined />,
    items: [
      { key: "/payroll", icon: <CalendarOutlined />, label: "Bảng lương tháng" },
      { key: "/payroll/rates", icon: <SettingOutlined />, label: "Đơn giá giờ" },
    ],
  },
  {
    key: "reports",
    label: "Báo cáo",
    icon: <BarChartOutlined />,
    single: true,
    items: [{ key: "/reports", icon: <BarChartOutlined />, label: "Báo cáo & Thống kê" }],
  },
  {
    key: "system",
    label: "Hệ thống",
    icon: <ControlOutlined />,
    items: [
      {
        key: "/settings",
        icon: <SettingOutlined />,
        label: "Cài đặt",
        children: SETTINGS_TABS.map((t) => ({ key: `/settings?tab=${t.key}`, label: t.label })),
      },
    ],
  },
];

/** Giáo viên, trợ giảng (DESIGN 4.2): 5 mục Hôm nay · Lịch · Lớp của tôi · Lương của tôi · Tài khoản. */
const STAFF_NAV: NavItem[] = [
  { key: "/", icon: <HomeOutlined />, label: "Hôm nay" },
  { key: "/my/schedule", icon: <CalendarOutlined />, label: "Lịch" },
  { key: "/my/classes", icon: <ReadOutlined />, label: "Lớp của tôi" },
  { key: "/my/payroll", icon: <DollarOutlined />, label: "Lương của tôi" },
  { key: "/my/account", icon: <IdcardOutlined />, label: "Tài khoản" },
];

/** Menu theo vai trò: mục không có quyền thì ẩn hẳn (DESIGN mục 7). */
function navFor(v: Viewer): NavGroup[] {
  if (isStaff(v) && v.teacherId) {
    return STAFF_NAV.map((n) => ({ key: n.key, label: n.label, icon: n.icon, single: true, items: [n] }));
  }
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((n) => canOpenPage(v, n.key)) }));
  return groups.filter((g) => g.items.length > 0);
}

function isActive(key: string, pathname: string) {
  return key === "/" ? pathname === "/" : pathname === key || pathname.startsWith(`${key}/`);
}

/** Khóa của mọi mục cha có thể mở/đóng (nhóm và trang có mục con). */
function parentKeys(groups: NavGroup[]) {
  return groups.flatMap((g) => [...(g.single ? [] : [g.key]), ...g.items.filter((n) => n.children).map((n) => n.key)]);
}

const OPEN_KEYS_STORAGE = "esl.nav.open";

function loadOpenKeys(): string[] | null {
  try {
    const raw = localStorage.getItem(OPEN_KEYS_STORAGE);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveOpenKeys(keys: string[]) {
  try {
    localStorage.setItem(OPEN_KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    // Trình duyệt chặn lưu thì thôi, lần sau mở lại mặc định.
  }
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
      <PrimerActionMenu>
        <PrimerActionMenu.Button
          variant="invisible"
          className="user-btn"
          aria-label="Tài khoản"
        >
          <Avatar size={32} style={{ background: "#1F6FEB", flexShrink: 0 }}>{initials(viewer.fullName)}</Avatar>
          {!compact && (
            <span className="user-btn-text">
              <b>{viewer.fullName}</b>
              <span>{roleLabel(viewer.role)}</span>
            </span>
          )}
          {!compact && <DownOutlined style={{ fontSize: 10, color: "#8C959F" }} />}
        </PrimerActionMenu.Button>
        <PrimerActionMenu.Overlay align="end" width="medium">
          <ActionList>
            <ActionList.Item disabled>
              <b>{viewer.fullName}</b>
              <ActionList.Description>{roleLabel(viewer.role)} · {viewer.username}</ActionList.Description>
            </ActionList.Item>
            <ActionList.Divider />
            <ActionList.Item onSelect={() => setChanging(true)}>
              <ActionList.LeadingVisual><KeyOutlined /></ActionList.LeadingVisual>
              Đổi mật khẩu
            </ActionList.Item>
            <ActionList.Item variant="danger" onSelect={() => void logout()}>
              <ActionList.LeadingVisual><LogoutOutlined /></ActionList.LeadingVisual>
              Đăng xuất
            </ActionList.Item>
          </ActionList>
        </PrimerActionMenu.Overlay>
      </PrimerActionMenu>
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
  // Menu đọc ?tab= trên đường dẫn nên cần Suspense khi dựng trang sẵn.
  return (
    <Suspense fallback={<FullPageSpin />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

function FullPageSpin() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Spin size="large" />
    </div>
  );
}

function SignedInShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") ?? SETTINGS_TABS[0].key;
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { viewer } = useSession();
  const { centers, centerId, setCenterId } = useCenters();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = useMemo(() => (viewer ? navFor(viewer) : []), [viewer]);
  // Mặc định mở hết các nhóm; người dùng đóng/mở nhóm nào thì nhớ lại cho lần sau.
  const [openKeys, setOpenKeys] = useState<string[] | null>(null);
  // Khi menu thu gọn, nhóm bung ra dạng popup, tách riêng để không ghi đè lựa chọn ở trên.
  const [popupKeys, setPopupKeys] = useState<string[]>([]);
  // Ô "Tìm kiếm chức năng" ở đầu menu: lọc mục menu theo tên.
  const [navQuery, setNavQuery] = useState("");

  useEffect(() => {
    if (!groups.length) return;
    // Trang đang mở luôn nằm trong nhóm đang bung.
    const active = groups.flatMap((g) =>
      g.items.filter((n) => isActive(n.key, pathname)).flatMap((n) => [...(g.single ? [] : [g.key]), ...(n.children ? [n.key] : [])]),
    );
    setOpenKeys((prev) => {
      const base = prev ?? loadOpenKeys() ?? parentKeys(groups);
      return [...new Set([...base, ...active])];
    });
    setPopupKeys([]);
  }, [groups, pathname]);

  if (!viewer) return <FullPageSpin />;

  const flat = groups.flatMap((g) => g.items);
  const selected = flat.filter((n) => isActive(n.key, pathname)).map((n) => n.key);
  const menuSelected = flat
    .filter((n) => isActive(n.key, pathname))
    .map((n) => (n.children ? `${n.key}?tab=${tab}` : n.key));
  const toMenu = (n: NavItem) =>
    n.children
      ? { key: n.key, icon: n.icon, label: n.label, children: n.children.map((c) => ({ key: c.key, label: <Link href={c.key}>{c.label}</Link> })) }
      : { key: n.key, icon: n.icon, label: <Link href={n.key}>{n.label}</Link> };
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
  const needle = fold(navQuery.trim());
  const shownGroups = needle
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter((n) => fold(n.label).includes(needle) || fold(g.label).includes(needle)),
        }))
        .filter((g) => g.items.length > 0)
    : groups;
  const menuItems = shownGroups.map((g) =>
    g.single ? toMenu(g.items[0]) : { key: g.key, icon: g.icon, label: g.label, children: g.items.map(toMenu) },
  );
  // Đang tìm thì mở hết nhóm để thấy kết quả.
  const menuOpenKeys = collapsed ? popupKeys : needle ? parentKeys(shownGroups) : (openKeys ?? []);
  // Đường dẫn hiển thị trên đầu trang: Nhóm › Trang.
  const crumbItem = flat
    .filter((n) => isActive(n.key, pathname))
    .sort((a, b) => b.key.length - a.key.length)[0];
  const crumbGroup = groups.find((g) => g.items.some((n) => n.key === crumbItem?.key));
  const crumbs = crumbItem
    ? [...(crumbGroup && !crumbGroup.single ? [{ title: crumbGroup.label }] : []), { title: crumbItem.label }]
    : [];
  const onOpenChange = (keys: string[]) => {
    if (collapsed) return setPopupKeys(keys);
    setOpenKeys(keys);
    saveOpenKeys(keys);
  };
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
          {!collapsed && (
            <div className="nav-search">
              <Input
                allowClear
                size="small"
                prefix={<SearchOutlined style={{ color: "#8C959F" }} />}
                placeholder="Tìm kiếm chức năng"
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
              />
            </div>
          )}
          <Menu
            mode="inline"
            selectedKeys={menuSelected}
            openKeys={menuOpenKeys}
            onOpenChange={onOpenChange}
            onClick={() => setPopupKeys([])}
            inlineIndent={18}
            items={menuItems}
            className="side-menu"
          />
        </Layout.Sider>
      )}
      <Layout>
        <Layout.Header className="topbar">
          {!isStaff(viewer) && (
            <PrimerActionMenu>
              <PrimerActionMenu.Button size="small">
                {centerId === 0
                  ? "Tất cả trung tâm"
                  : (() => {
                      const cur = centers.find((c) => c.id === centerId);
                      return cur ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className="dot" style={{ background: cur.color }} />
                          {cur.name}
                        </span>
                      ) : (
                        "Chọn trung tâm"
                      );
                    })()}
              </PrimerActionMenu.Button>
              <PrimerActionMenu.Overlay align="start" width="medium">
                <ActionList selectionVariant="single">
                  {canSeeAllCenters(viewer) && (
                    <ActionList.Item selected={centerId === 0} onSelect={() => setCenterId(0)}>
                      Tất cả trung tâm
                    </ActionList.Item>
                  )}
                  {centers.map((c) => (
                    <ActionList.Item key={c.id} selected={centerId === c.id} onSelect={() => setCenterId(c.id)}>
                      <ActionList.LeadingVisual>
                        <span className="dot" style={{ background: c.color }} />
                      </ActionList.LeadingVisual>
                      {c.name}
                    </ActionList.Item>
                  ))}
                </ActionList>
              </PrimerActionMenu.Overlay>
            </PrimerActionMenu>
          )}
          <GlobalSearch placeholder={isStaff(viewer) ? "Tìm học sinh lớp mình" : "Tìm HS / PH / GV, tên hoặc SĐT"} />
          <div style={{ flex: 1 }} />
          <UserMenu viewer={viewer} compact={isMobile} />
        </Layout.Header>
        <Layout.Content className="content" style={{ paddingBottom: isMobile ? 72 : 24 }}>
          {allowed && !isMobile && crumbs.length > 0 && (
            <PrimerBreadcrumbs className="crumbs">
              {crumbs.map((c, i) => (
                <PrimerBreadcrumbs.Item key={i} selected={i === crumbs.length - 1}>
                  {c.title}
                </PrimerBreadcrumbs.Item>
              ))}
            </PrimerBreadcrumbs>
          )}
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
