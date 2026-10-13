"use client";

import { CheckOutlined } from "@/client/primer-icons";
import { App, Button, Input, Select, Space } from "@/client/primer-compat";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { computeTotal, isValidScore, SKILLS, TEST_KINDS, type SkillKey } from "@/lib/curriculum";

export type ScoreRow = {
  studentId: number;
  kind: string;
  listening: number | null;
  speaking: number | null;
  reading: number | null;
  writing: number | null;
  total: number | null;
  note: string | null;
};

type Field = SkillKey | "total";
type Draft = Record<Field, string> & { note: string };

const FIELDS: { key: Field; label: string }[] = [...SKILLS.map((s) => ({ key: s.key as Field, label: s.label })), { key: "total", label: "Tổng" }];

const toText = (v: number | null | undefined) => (v == null ? "" : String(v));
/** "7,5" hoặc "7.5" → 7.5; trống → null; sai → NaN để báo lỗi. */
const toNumber = (t: string) => (t.trim() === "" ? null : Number(t.replace(",", ".")));

/**
 * Nhập điểm kiểm tra theo kỹ năng (thang 10) cho cả buổi. Ô Tổng để trống thì tự lấy trung bình
 * các kỹ năng đã nhập. Xóa hết điểm của một học sinh = bỏ điểm của em đó.
 */
export function ScoresPanel({
  sessionId,
  students,
  scores,
  defaultKind,
  canEdit,
  onSaved,
}: {
  sessionId: number;
  students: { studentId: number; fullName: string }[];
  scores: ScoreRow[];
  defaultKind: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [kind, setKind] = useState(defaultKind);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const by = new Map(scores.map((s) => [s.studentId, s]));
    setDrafts(
      Object.fromEntries(
        students.map((st) => {
          const s = by.get(st.studentId);
          // Tổng tự tính thì để trống ô Tổng, chỉ giữ khi khác trung bình (đã nhập tay).
          const auto = s ? computeTotal(s) : null;
          return [
            st.studentId,
            {
              listening: toText(s?.listening),
              speaking: toText(s?.speaking),
              reading: toText(s?.reading),
              writing: toText(s?.writing),
              total: s && s.total !== auto ? toText(s.total) : "",
              note: s?.note ?? "",
            },
          ];
        }),
      ),
    );
    if (scores[0]) setKind(scores[0].kind);
  }, [scores, students]);

  const set = (id: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const save = async () => {
    const items = students.map((st) => {
      const d = drafts[st.studentId];
      return {
        studentId: st.studentId,
        listening: toNumber(d.listening),
        speaking: toNumber(d.speaking),
        reading: toNumber(d.reading),
        writing: toNumber(d.writing),
        total: toNumber(d.total),
        note: d.note,
      };
    });
    const bad = items.find((it) => FIELDS.some((f) => !isValidScore(it[f.key])));
    if (bad) {
      message.error(`Điểm của ${students.find((s) => s.studentId === bad.studentId)?.fullName} không hợp lệ (0–10)`);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/sessions/${sessionId}/scores`, { method: "PUT", body: { kind, items } });
      message.success("Đã lưu điểm");
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <Space wrap style={{ marginBottom: 8 }}>
        <b>Điểm kiểm tra</b>
        <Select
          size="small"
          value={kind}
          onChange={(v: string) => setKind(v)}
          disabled={!canEdit}
          options={TEST_KINDS.map((k) => ({ value: k.value, label: k.label }))}
          style={{ width: 160 }}
        />
        <span className="sub">Thang 10. Ô Tổng để trống thì tự lấy trung bình.</span>
      </Space>
      {/* width 0 + minWidth 100%: bảng rộng chỉ cuộn ngang trong khung, không đẩy cả trang rộng ra trên điện thoại. */}
      <div style={{ overflowX: "auto", width: 0, minWidth: "100%" }}>
        <table className="score-table">
          <thead>
            <tr>
              <th>Học sinh</th>
              {FIELDS.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => {
              const d = drafts[st.studentId];
              if (!d) return null;
              const auto = computeTotal(
                Object.fromEntries(SKILLS.map((s) => [s.key, toNumber(d[s.key])])) as Record<SkillKey, number | null>,
              );
              return (
                <tr key={st.studentId}>
                  <td style={{ whiteSpace: "nowrap" }}>{st.fullName}</td>
                  {FIELDS.map((f) => (
                    <td key={f.key}>
                      <Input
                        size="small"
                        inputMode="decimal"
                        style={{ width: 64 }}
                        disabled={!canEdit}
                        value={d[f.key]}
                        placeholder={f.key === "total" && auto != null && Number.isFinite(auto) ? String(auto) : ""}
                        onChange={(e) => set(st.studentId, { [f.key]: e.target.value } as Partial<Draft>)}
                      />
                    </td>
                  ))}
                  <td>
                    <Input size="small" style={{ minWidth: 140 }} maxLength={300} disabled={!canEdit} value={d.note} onChange={(e) => set(st.studentId, { note: e.target.value })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <Button type="primary" icon={<CheckOutlined />} loading={saving} onClick={save}>
            Lưu điểm
          </Button>
        </div>
      )}
    </div>
  );
}
