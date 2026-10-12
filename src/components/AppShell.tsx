"use client";

import {
  AlertIcon,
  AppsIcon,
  BookIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChecklistIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  DeviceMobileIcon,
  GearIcon,
  GraphIcon,
  HomeIcon,
  KeyIcon,
  MortarBoardIcon,
  PeopleIcon,
  PersonIcon,
  SearchIcon,
  SignOutIcon,
  TagIcon,
  XIcon,
} from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu as PrimerActionMenu,
  Breadcrumbs as PrimerBreadcrumbs,
  NavList,
  Spinner,
  TextInput,
} from "@primer/react";
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
  { key: "today", label: "Tổng quan", icon: <HomeIcon size={16} />, single: true, items: [{ key: "/", icon: <HomeIcon size={16} />, label: "Hôm nay" }] },
  {
    key: "teaching",
    label: "Đào tạo",
    icon: <MortarBoardIcon size={16} />,
    items: [
      { key: "/schedule", icon: <CalendarIcon size={16} />, label: "Lịch học" },
      { key: "/classes", icon: <BookIcon size={16} />, label: "Lớp học" },
      { key: "/makeups", icon: <ClockIcon size={16} />, label: "Học bù" },
    ],
  },
  {
    key: "people",
    label: "Con người",
    icon: <PeopleIcon size={16} />,
    items: [
      { key: "/students", icon: <PersonIcon size={16} />, label: "Học sinh" },
      { key: "/parents", icon: <PeopleIcon size={16} />, label: "Phụ huynh" },
      { key: "/followups", icon: <DeviceMobileIcon size={16} />, label: "Cần gọi lại" },
      { key: "/teachers", icon: <BriefcaseIcon size={16} />, label: "Giáo viên" },
    ],
  },
  {
    key: "finance",
    label: "Tài chính",
    icon: <CreditCardIcon size={16} />,
    items: [
      { key: "/finance", icon: <CreditCardIcon size={16} />, label: "Thu học phí" },
      { key: "/finance/debts", icon: <AlertIcon size={16} />, label: "Công nợ" },
      { key: "/finance/expenses", icon: <GraphIcon size={16} />, label: "Chi phí" },
    ],
  },
  {
    key: "payroll",
    label: "Lương",
    icon: <ChecklistIcon size={16} />,
    items: [
      { key: "/payroll", icon: <CalendarIcon size={16} />, label: "Bảng lương tháng" },
      { key: "/payroll/rates", icon: <TagIcon size={16} />, label: "Đơn giá giờ" },
    ],
  },
  {
    key: "reports",
    label: "Báo cáo",
    icon: <GraphIcon size={16} />,
    single: true,
    items: [{ key: "/reports", icon: <GraphIcon size={16} />, label: "Báo cáo & Thống kê" }],
  },
  {
    key: "system",
    label: "Hệ thống",
    icon: <GearIcon size={16} />,
    items: [
      {
        key: "/settings",
        icon: <GearIcon size={16} />,
        label: "Cài đặt",
        children: SETTINGS_TABS.map((t) => ({ key: `/settings?tab=${t.key}`, label: t.label })),
      },
    ],
  },
];

/** Giáo viên, trợ giảng (DESIGN 4.2): 5 mục Hôm nay · Lịch · Lớp của tôi · Lương của tôi · Tài khoản. */
const STAFF_NAV: NavItem[] = [
  { key: "/", icon: <HomeIcon size={16} />, label: "Hôm nay" },
  { key: "/my/schedule", icon: <CalendarIcon size={16} />, label: "Lịch" },
  { key: "/my/classes", icon: <BookIcon size={16} />, label: "Lớp của tôi" },
  { key: "/my/payroll", icon: <CreditCardIcon size={16} />, label: "Lương của tôi" },
  { key: "/my/account", icon: <PersonIcon size={16} />, label: "Tài khoản" },
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
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#1F6FEB",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {initials(viewer.fullName)}
          </span>
          {!compact && (
            <span className="user-btn-text">
              <b>{viewer.fullName}</b>
              <span>{roleLabel(viewer.role)}</span>
            </span>
          )}
        </PrimerActionMenu.Button>
        <PrimerActionMenu.Overlay align="end" width="medium">
          <ActionList>
            <ActionList.Item disabled>
              <b>{viewer.fullName}</b>
              <ActionList.Description>{roleLabel(viewer.role)} · {viewer.username}</ActionList.Description>
            </ActionList.Item>
            <ActionList.Divider />
            <ActionList.Item onSelect={() => setChanging(true)}>
              <ActionList.LeadingVisual><KeyIcon size={16} /></ActionList.LeadingVisual>
              Đổi mật khẩu
            </ActionList.Item>
            <ActionList.Item variant="danger" onSelect={() => void logout()}>
              <ActionList.LeadingVisual><SignOutIcon size={16} /></ActionList.LeadingVisual>
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setRes(null);
      return;
    }
    let alive = true;
    api<SearchResult>(`/api/search${qs({ q: dq })}`)
      .then((r) => {
        if (alive) {
          setRes(r);
          setOpen(true);
        }
      })
      .catch(() => alive && setRes(null));
    return () => {
      alive = false;
    };
  }, [dq]);

  const hasResults = res && (res.students.length > 0 || res.parents.length > 0 || res.teachers.length > 0);

  return (
    <div style={{ position: "relative", width: 280 }}>
      <TextInput
        block
        leadingVisual={SearchIcon}
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (res) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 250)}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(140,149,159,0.2)",
            border: "1px solid #d0d7de",
            zIndex: 100,
            maxHeight: 360,
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {!hasResults ? (
            <div style={{ padding: "8px 12px", color: "#8c959f", fontSize: 13 }}>
              {dq.trim().length >= 2 ? "Không tìm thấy kết quả" : "Nhập ít nhất 2 ký tự..."}
            </div>
          ) : (
            <>
              {res.students.length > 0 && (
                <div>
                  <div style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#59636e", textTransform: "uppercase" }}>Học sinh</div>
                  {res.students.map((s) => (
                    <div
                      key={s.id}
                      style={{ padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
                      onMouseDown={() => {
                        setOpen(false);
                        setQ("");
                        router.push(`/students/${s.id}`);
                      }}
                    >
                      <b style={{ color: "#0969da" }}>{s.fullName}</b> {s.englishName ? `(${s.englishName})` : ""} · {s.code} · {s.center.name}
                    </div>
                  ))}
                </div>
              )}
              {res.parents.length > 0 && (
                <div>
                  <div style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#59636e", textTransform: "uppercase" }}>Phụ huynh</div>
                  {res.parents.map((p) => (
                    <div
                      key={p.id}
                      style={{ padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
                      onMouseDown={() => {
                        setOpen(false);
                        setQ("");
                        router.push(`/parents/${p.id}`);
                      }}
                    >
                      <b style={{ color: "#0969da" }}>{p.fullName}</b> · {formatPhone(p.phone)}
                    </div>
                  ))}
                </div>
              )}
              {res.teachers.length > 0 && (
                <div>
                  <div style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#59636e", textTransform: "uppercase" }}>Giáo viên</div>
                  {res.teachers.map((t) => (
                    <div
                      key={t.id}
                      style={{ padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
                      onMouseDown={() => {
                        setOpen(false);
                        setQ("");
                        router.push(`/teachers/${t.id}`);
                      }}
                    >
                      <b style={{ color: "#0969da" }}>{t.displayName}</b> · {t.code}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
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
      <Spinner size="large" />
    </div>
  );
}

function SignedInShell({ children }: { children: ReactNode }) {
  const { viewer } = useSession();
  const { centers, centerId, setCenterId } = useCenters();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "centers";

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = useMemo(() => (viewer ? navFor(viewer) : []), [viewer]);

  // Ô "Tìm kiếm chức năng" ở đầu menu: lọc mục menu theo tên.
  const [navQuery, setNavQuery] = useState("");

  if (!viewer) return <FullPageSpin />;

  const flat = groups.flatMap((g) => g.items);
  const selected = flat.filter((n) => isActive(n.key, pathname)).map((n) => n.key);
  const bestKey = [...selected].sort((a, b) => b.length - a.length)[0];
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

  // Đường dẫn hiển thị trên đầu trang: Nhóm › Trang.
  const crumbItem = flat
    .filter((n) => isActive(n.key, pathname))
    .sort((a, b) => b.key.length - a.key.length)[0];
  const crumbGroup = groups.find((g) => g.items.some((n) => n.key === crumbItem?.key));
  const crumbs = crumbItem
    ? [...(crumbGroup && !crumbGroup.single ? [{ title: crumbGroup.label }] : []), { title: crumbItem.label }]
    : [];

  const allowed = canOpenPage(viewer, pathname);
  // Di động: 4 mục đầu ở thanh dưới, phần còn lại trong "Thêm".
  const bottom = flat.length > 5 ? flat.slice(0, 4) : flat;
  const moreActive = flat.length > 5 && !bottom.some((n) => selected.includes(n.key));

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f6f8fa" }}>
      {!isMobile && (
        <aside
          className={`sider${collapsed ? " collapsed" : ""}`}
          style={{
            width: collapsed ? 72 : 232,
            borderRight: "1px solid #eef1f4",
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <div className="nav-search" style={{ padding: "0 12px 8px 12px" }}>
              <TextInput
                block
                size="small"
                leadingVisual={SearchIcon}
                placeholder="Tìm chức năng..."
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
              />
            </div>
          )}
          <nav aria-label="Menu chính" style={{ padding: collapsed ? "0 4px" : "0 8px 24px 8px", flex: 1 }}>
            <NavList>
              {shownGroups.map((g) => {
                if (g.single) {
                  const item = g.items[0];
                  const active = item.key === bestKey;
                  return (
                    <NavList.Item
                      key={item.key}
                      as={Link}
                      href={item.key}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      <NavList.LeadingVisual>{item.icon}</NavList.LeadingVisual>
                      {!collapsed && item.label}
                    </NavList.Item>
                  );
                }
                return (
                  <NavList.Group key={g.key} title={!collapsed ? g.label : undefined}>
                    {g.items.map((item) => {
                      const active = item.key === bestKey;
                      if (item.children) {
                        return (
                          <NavList.Item
                            key={item.key}
                            defaultOpen={active}
                            title={collapsed ? item.label : undefined}
                          >
                            <NavList.LeadingVisual>{item.icon}</NavList.LeadingVisual>
                            {!collapsed && item.label}
                            {!collapsed && (
                              <NavList.SubNav>
                                {item.children.map((c) => {
                                  const subActive = pathname === "/settings" && tab === c.key.split("tab=")[1];
                                  return (
                                    <NavList.Item
                                      key={c.key}
                                      as={Link}
                                      href={c.key}
                                      aria-current={subActive ? "page" : undefined}
                                    >
                                      {c.label}
                                    </NavList.Item>
                                  );
                                })}
                              </NavList.SubNav>
                            )}
                          </NavList.Item>
                        );
                      }
                      return (
                        <NavList.Item
                          key={item.key}
                          as={Link}
                          href={item.key}
                          aria-current={active ? "page" : undefined}
                          title={collapsed ? item.label : undefined}
                        >
                          <NavList.LeadingVisual>{item.icon}</NavList.LeadingVisual>
                          {!collapsed && item.label}
                        </NavList.Item>
                      );
                    })}
                  </NavList.Group>
                );
              })}
            </NavList>
          </nav>
        </aside>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="topbar">
          {allowed && !isMobile && crumbs.length > 0 && (
            <PrimerBreadcrumbs className="crumbs" style={{ margin: 0, fontSize: 13 }}>
              {crumbs.map((c, i) => (
                <PrimerBreadcrumbs.Item key={i} selected={i === crumbs.length - 1}>
                  {c.title}
                </PrimerBreadcrumbs.Item>
              ))}
            </PrimerBreadcrumbs>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
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
                <PrimerActionMenu.Overlay align="end" width="medium">
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
            <UserMenu viewer={viewer} compact={isMobile} />
          </div>
        </header>
        <main className="content" style={{ paddingBottom: isMobile ? 72 : 24, flex: 1 }}>
          {allowed ? (
            children
          ) : (
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <AlertIcon size={48} fill="#CF222E" />
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "16px 0 8px 0" }}>Không có quyền</h2>
              <p style={{ color: "#59636E", marginBottom: 20 }}>Tài khoản của bạn không mở được trang này.</p>
              <Link href="/" style={{ color: "#0969DA", fontWeight: 600 }}>Về trang Hôm nay</Link>
            </div>
          )}
        </main>
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
                <AppsIcon size={16} />
                <span>Thêm</span>
              </button>
            )}
          </nav>
        )}
        {isMobile && moreOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
            onClick={() => setMoreOpen(false)}
          >
            <div
              style={{
                background: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 16,
                maxHeight: "80vh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <b style={{ fontSize: 16 }}>Tất cả mục</b>
                <button
                  type="button"
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}
                  onClick={() => setMoreOpen(false)}
                >
                  <XIcon size={18} />
                </button>
              </div>
              {groups.map((g) => (
                <div key={g.key} className="more-group" style={{ marginBottom: 16 }}>
                  <div className="more-group-label" style={{ fontWeight: 600, fontSize: 12, color: "#59636E", marginBottom: 8 }}>{g.label}</div>
                  <div className="more-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {g.items.map((n) => (
                      <Link
                        key={n.key}
                        href={n.key}
                        onClick={() => setMoreOpen(false)}
                        className={selected.includes(n.key) ? "active" : ""}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "12px 8px",
                          borderRadius: 8,
                          textDecoration: "none",
                          color: "#1F2328",
                          background: selected.includes(n.key) ? "#DDF4FF" : "#F6F8FA",
                          fontSize: 12,
                          gap: 6,
                          textAlign: "center",
                        }}
                      >
                        {n.icon}
                        <span>{n.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
