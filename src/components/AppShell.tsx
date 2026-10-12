"use client";

import {
  CalendarOutlined,
  HomeOutlined,
  ReadOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { AutoComplete, Grid, Input, Layout, Menu, Select } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { api, qs, useDebounced } from "@/client/api";
import { useCenters } from "@/client/centers";
import { formatPhone } from "@/lib/text";
import { useEffect } from "react";

const NAV = [
  { key: "/", icon: <HomeOutlined />, label: "Hôm nay" },
  { key: "/schedule", icon: <CalendarOutlined />, label: "Lịch học" },
  { key: "/classes", icon: <ReadOutlined />, label: "Lớp học" },
  { key: "/students", icon: <UserOutlined />, label: "Học sinh" },
  { key: "/parents", icon: <TeamOutlined />, label: "Phụ huynh" },
  { key: "/teachers", icon: <SolutionOutlined />, label: "Giáo viên" },
  { key: "/settings", icon: <SettingOutlined />, label: "Cài đặt" },
];

type SearchResult = {
  students: { id: number; code: string; fullName: string; englishName: string | null; center: { name: string } }[];
  parents: { id: number; fullName: string; phone: string }[];
  teachers: { id: number; code: string; displayName: string }[];
};

function GlobalSearch() {
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
      <Input.Search placeholder="Tìm HS / PH / GV, tên hoặc SĐT" allowClear />
    </AutoComplete>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { centers, centerId, setCenterId } = useCenters();
  const selected = NAV.filter((n) => (n.key === "/" ? pathname === "/" : pathname.startsWith(n.key))).map((n) => n.key);

  const menuItems = NAV.map((n) => ({ key: n.key, icon: n.icon, label: <Link href={n.key}>{n.label}</Link> }));

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
          <Select
            value={centerId}
            onChange={setCenterId}
            style={{ width: isMobile ? 130 : 190 }}
            options={[
              { value: 0, label: "Tất cả trung tâm" },
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
          <GlobalSearch />
        </Layout.Header>
        <Layout.Content className="content" style={{ paddingBottom: isMobile ? 72 : 24 }}>
          {children}
        </Layout.Content>
        {isMobile && (
          <nav className="bottom-nav">
            {NAV.slice(0, 5).map((n) => (
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
