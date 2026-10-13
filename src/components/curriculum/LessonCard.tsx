"use client";

import { BookOutlined, LinkOutlined } from "@/client/primer-icons";
import { Button, Space, Tag } from "@/client/primer-compat";
import { useState } from "react";
import { testKindOption, type Material } from "@/lib/curriculum";

export type Lesson = {
  id: number;
  index: number;
  title: string;
  objectives: string | null;
  content: string | null;
  homework: string | null;
  materials: Material[];
  testKind: string | null;
};

export function TestKindTag({ value }: { value: string | null | undefined }) {
  const o = testKindOption(value);
  return o ? <Tag color={o.color}>{o.label}</Tag> : null;
}

/** "Bài hôm nay" theo khung chương trình: chủ đề luôn hiện, bấm để xem mục tiêu, nội dung, bài tập, tài liệu. */
export function LessonCard({ lesson, defaultOpen = false }: { lesson: Lesson | null; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!lesson) return null;
  const hasMore = !!(lesson.objectives || lesson.content || lesson.homework || lesson.materials.length);
  const block = (label: string, text: string | null) =>
    text ? (
      <div style={{ marginTop: 8 }}>
        <div className="sub">{label}</div>
        <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    ) : null;
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <Space wrap size={[8, 4]} style={{ width: "100%" }}>
        <BookOutlined />
        <span className="sub">Bài buổi {lesson.index}:</span>
        <b>{lesson.title}</b>
        <TestKindTag value={lesson.testKind} />
        {hasMore && (
          <Button size="small" type="link" style={{ padding: 0 }} onClick={() => setOpen(!open)}>
            {open ? "Thu gọn" : "Xem chi tiết"}
          </Button>
        )}
      </Space>
      {open && (
        <>
          {block("Mục tiêu", lesson.objectives)}
          {block("Nội dung", lesson.content)}
          {block("Bài tập về nhà", lesson.homework)}
          {lesson.materials.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="sub">Tài liệu</div>
              {lesson.materials.map((m, i) => (
                <div key={i}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    <LinkOutlined /> {m.name}
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
