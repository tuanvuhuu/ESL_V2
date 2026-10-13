"use client";

import { EditOutlined } from "@/client/primer-icons";
import { Button, Empty, Segmented, Select, Skeleton } from "@/client/primer-compat";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useApi } from "@/client/api";
import { useViewer } from "@/client/session";
import type { Course } from "@/client/types";
import { CurriculumModal } from "@/components/curriculum/CurriculumModal";
import { LessonCard, type Lesson } from "@/components/curriculum/LessonCard";
import { ClassLessonPlan } from "@/components/lessons/ClassLessonPlan";
import { PageHeader } from "@/components/ui";
import { canManageSettings } from "@/lib/permissions";

type ClassLite = { id: number; code: string; name: string; status: string; courseId: number | null; course: { name: string } | null };

/** E1: Bài giảng và bài tập. Theo lớp: từng buổi dạy bài gì, giao bài tập gì. Khung chương trình: bài của từng khóa. */
export default function LessonsPage() {
  return (
    <Suspense fallback={<Skeleton active />}>
      <Lessons />
    </Suspense>
  );
}

function Lessons() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const view = sp.get("view") === "course" ? "course" : "class";
  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) if (v == null) next.delete(k);
    else next.set(k, v);
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <>
      <PageHeader
        title="Bài giảng & bài tập"
        description="Buổi số N của lớp tự lấy bài số N trong khung chương trình của khóa."
        actions={
          <Segmented
            value={view}
            onChange={(v) => setParam({ view: v === "course" ? "course" : null })}
            options={[
              { value: "class", label: "Theo lớp" },
              { value: "course", label: "Khung chương trình" },
            ]}
          />
        }
      />
      {view === "class" ? (
        <ByClass classId={Number(sp.get("class")) || null} onPick={(id) => setParam({ class: String(id) })} />
      ) : (
        <ByCourse courseId={Number(sp.get("course")) || null} onPick={(id) => setParam({ course: String(id) })} />
      )}
    </>
  );
}

function ByClass({ classId, onPick }: { classId: number | null; onPick: (id: number) => void }) {
  const { data, loading } = useApi<ClassLite[]>("/api/classes");
  const classes = useMemo(() => {
    const rank = (s: string) => ["ACTIVE", "PLANNED", "FINISHED", "CANCELLED"].indexOf(s);
    return [...(data ?? [])].sort((a, b) => rank(a.status) - rank(b.status) || a.code.localeCompare(b.code));
  }, [data]);
  if (loading && !data) return <Skeleton active />;
  if (classes.length === 0) return <Empty description="Chưa có lớp nào." />;
  const current = classes.find((c) => c.id === classId) ?? classes[0];
  return (
    <>
      <div className="filter-bar">
        <Select
          showSearch
          style={{ minWidth: 320 }}
          value={current.id}
          onChange={(v: number) => onPick(v)}
          options={classes.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}${c.course ? ` (${c.course.name})` : ""}` }))}
        />
      </div>
      <ClassLessonPlan key={current.id} classId={current.id} />
    </>
  );
}

function ByCourse({ courseId, onPick }: { courseId: number | null; onPick: (id: number) => void }) {
  const canEdit = canManageSettings(useViewer());
  const { data: courses, loading } = useApi<Course[]>("/api/courses");
  const current = courses?.find((c) => c.id === courseId) ?? courses?.[0] ?? null;
  const { data, reload } = useApi<{ lessons: Lesson[] }>(current ? `/api/courses/${current.id}/lessons` : null);
  const [editing, setEditing] = useState<Course | null>(null);
  if (loading && !courses) return <Skeleton active />;
  if (!current) return <Empty description="Chưa có khóa học nào." />;
  const lessons = data?.lessons ?? [];
  return (
    <>
      <div className="filter-bar">
        <Select
          showSearch
          style={{ minWidth: 280 }}
          value={current.id}
          onChange={(v: number) => onPick(v)}
          options={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <span className="sub">
          {lessons.length}/{current.totalSessions} buổi có bài
        </span>
        <div className="spacer" />
        {canEdit && (
          <Button icon={<EditOutlined />} onClick={() => setEditing(current)}>
            Sửa khung chương trình
          </Button>
        )}
      </div>
      {data && lessons.length === 0 && <Empty description={canEdit ? "Khóa này chưa có khung chương trình. Bấm Sửa khung chương trình để thêm." : "Khóa này chưa có khung chương trình."} />}
      {lessons.map((l) => (
        <LessonCard key={l.id} lesson={l} />
      ))}
      <CurriculumModal
        course={editing}
        onClose={() => {
          setEditing(null);
          void reload();
        }}
      />
    </>
  );
}
