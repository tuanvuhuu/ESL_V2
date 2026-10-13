"use client";

import { DeleteOutlined, PlusOutlined } from "@/client/primer-icons";
import { App, Button, Empty, Input, InputNumber, Modal, Select, Space, Spin } from "@/client/primer-compat";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import type { Course } from "@/client/types";
import { fillLessons, TEST_KINDS, type Material } from "@/lib/curriculum";
import { TestKindTag, type Lesson } from "./LessonCard";

type Draft = Omit<Lesson, "id">;

const blank = (index: number): Draft => ({ index, title: `Buổi ${index}`, objectives: null, content: null, homework: null, materials: [], testKind: null });

/**
 * Sửa khung chương trình của một khóa: danh sách buổi bên trái, chi tiết buổi đang chọn bên phải.
 * Lưu cả danh sách một lần. Lớp đang học thấy ngay bài mới vì buổi số N lấy bài số N.
 */
export function CurriculumModal({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const { message } = App.useApp();
  const [lessons, setLessons] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!course) return;
    setLoading(true);
    api<{ lessons: Lesson[] }>(`/api/courses/${course.id}/lessons`)
      .then((r) => {
        setLessons(r.lessons.map(({ id: _id, ...l }) => l));
        setSelected(r.lessons[0]?.index ?? null);
      })
      .catch((e) => message.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [course, message]);

  if (!course) return null;
  const current = lessons.find((l) => l.index === selected) ?? null;
  const patch = (p: Partial<Draft>) => setLessons((ls) => ls.map((l) => (l.index === selected ? { ...l, ...p } : l)));
  const setMaterial = (i: number, p: Partial<Material>) => patch({ materials: current!.materials.map((m, j) => (j === i ? { ...m, ...p } : m)) });

  const addLesson = () => {
    const index = (lessons.reduce((m, l) => Math.max(m, l.index), 0) || 0) + 1;
    setLessons((ls) => [...ls, blank(index)]);
    setSelected(index);
  };

  const save = async () => {
    const empty = lessons.find((l) => !l.title.trim());
    if (empty) {
      message.error(`Buổi ${empty.index} chưa có chủ đề`);
      setSelected(empty.index);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/courses/${course.id}/lessons`, {
        method: "PUT",
        body: { lessons: lessons.map((l) => ({ ...l, materials: l.materials.filter((m) => m.url.trim()) })) },
      });
      message.success("Đã lưu khung chương trình");
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Khung chương trình · ${course.name}`} width={1000} onCancel={onClose} onOk={save} confirmLoading={saving} okText="Lưu" cancelText="Đóng">
      {loading ? (
        <Spin />
      ) : (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button icon={<PlusOutlined />} onClick={addLesson}>
              Thêm buổi
            </Button>
            {lessons.length < course.totalSessions && (
              <Button onClick={() => setLessons((ls) => fillLessons(ls, course.totalSessions, blank))}>Tạo đủ {course.totalSessions} buổi</Button>
            )}
            <span className="sub">
              {lessons.length}/{course.totalSessions} buổi có bài. Buổi số N của lớp tự lấy bài số N.
            </span>
          </Space>
          {lessons.length === 0 ? (
            <Empty description="Khóa này chưa có khung chương trình." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) 1fr", gap: 16, minHeight: 360 }}>
              <div style={{ maxHeight: 480, overflowY: "auto", borderRight: "1px solid #D1D9E0", paddingRight: 8 }}>
                {[...lessons]
                  .sort((a, b) => a.index - b.index)
                  .map((l) => (
                    <div
                      key={l.index}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(l.index)}
                      onKeyDown={(e) => e.key === "Enter" && setSelected(l.index)}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        background: l.index === selected ? "#DDF4FF" : undefined,
                      }}
                    >
                      <span className="sub">{l.index}.</span> {l.title || <i className="sub">chưa có chủ đề</i>} <TestKindTag value={l.testKind} />
                    </div>
                  ))}
              </div>
              {current && (
                <div>
                  <Space wrap style={{ marginBottom: 8 }}>
                    <span>Buổi số</span>
                    <InputNumber
                      size="small"
                      style={{ width: 80 }}
                      value={current.index}
                      onChange={(v) => {
                        const n = Number(v);
                        if (!Number.isInteger(n) || n < 1 || n > 300) return;
                        if (lessons.some((l) => l.index === n && l !== current)) return message.error(`Đã có buổi ${n}`);
                        patch({ index: n });
                        setSelected(n);
                      }}
                    />
                    <Select
                      size="small"
                      allowClear
                      placeholder="Buổi thường"
                      style={{ width: 170 }}
                      value={current.testKind ?? undefined}
                      onChange={(v: string | undefined) => patch({ testKind: v ?? null })}
                      options={TEST_KINDS.map((k) => ({ value: k.value, label: `Kiểm tra: ${k.label}` }))}
                    />
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        setLessons((ls) => ls.filter((l) => l !== current));
                        setSelected(null);
                      }}
                    >
                      Xóa buổi
                    </Button>
                  </Space>
                  <div className="sub">Chủ đề</div>
                  <Input value={current.title} maxLength={200} onChange={(e) => patch({ title: e.target.value })} placeholder="Unit 1 – Hello" />
                  <div className="sub" style={{ marginTop: 8 }}>
                    Mục tiêu
                  </div>
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={1000} value={current.objectives ?? ""} onChange={(e) => patch({ objectives: e.target.value })} />
                  <div className="sub" style={{ marginTop: 8 }}>
                    Nội dung
                  </div>
                  <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={2000} value={current.content ?? ""} onChange={(e) => patch({ content: e.target.value })} />
                  <div className="sub" style={{ marginTop: 8 }}>
                    Bài tập về nhà
                  </div>
                  <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={1000} value={current.homework ?? ""} onChange={(e) => patch({ homework: e.target.value })} />
                  <div className="sub" style={{ marginTop: 8 }}>
                    Tài liệu (link giáo án, slide, audio trên Google Drive…)
                  </div>
                  {current.materials.map((m, i) => (
                    <Space key={i} style={{ display: "flex", marginBottom: 4 }}>
                      <Input size="small" style={{ width: 180 }} placeholder="Tên" value={m.name} onChange={(e) => setMaterial(i, { name: e.target.value })} />
                      <Input size="small" style={{ width: 340 }} placeholder="https://…" value={m.url} onChange={(e) => setMaterial(i, { url: e.target.value })} />
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => patch({ materials: current.materials.filter((_, j) => j !== i) })} />
                    </Space>
                  ))}
                  <Button size="small" icon={<PlusOutlined />} onClick={() => patch({ materials: [...current.materials, { name: "", url: "" }] })}>
                    Thêm link
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
