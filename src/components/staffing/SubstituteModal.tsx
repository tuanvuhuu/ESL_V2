"use client";

import { App, Button, List, Modal, Skeleton, Space, Tag } from "antd";
import { useState } from "react";
import { api, useApi } from "@/client/api";
import { formatDateVN } from "@/lib/dates";

export type Candidate = {
  id: number;
  displayName: string;
  fullName: string;
  current: boolean;
  availability: "FREE" | "OUTSIDE" | "UNKNOWN";
  onLeave: string | null;
  busy: string | null;
  blocked: boolean;
  teachesCenter: boolean;
  taughtCourse: boolean;
};

export type SubstituteTarget = { id: number; date: string; startTime: string; endTime: string; classCode: string };

/** Nhãn mức phù hợp của một người với buổi cần dạy thay (DESIGN 6.3). */
export function CandidateTags({ c }: { c: Candidate }) {
  return (
    <Space size={[4, 4]} wrap>
      {c.onLeave && <Tag color="red">Đang nghỉ</Tag>}
      {c.busy && <Tag color={c.blocked ? "red" : "orange"}>{c.busy}</Tag>}
      {c.availability === "FREE" && <Tag color="green">Rảnh</Tag>}
      {c.availability === "OUTSIDE" && <Tag color="orange">Ngoài lịch rảnh</Tag>}
      {c.availability === "UNKNOWN" && <Tag>Chưa khai lịch rảnh</Tag>}
      {!c.teachesCenter && <Tag>Chưa dạy ở trung tâm này</Tag>}
      {!c.taughtCourse && <Tag>Chưa dạy khóa này</Tag>}
    </Space>
  );
}

/** Lời nhắc khi chọn người ngoài lịch rảnh hoặc đang nghỉ; null = không cần hỏi lại. */
export function candidateWarning(c: Candidate): string | null {
  if (c.onLeave) return `${c.displayName} đang đăng ký nghỉ ngày này. Vẫn xếp dạy thay?`;
  if (c.busy) return `${c.displayName}: ${c.busy}. Vẫn xếp dạy thay?`;
  if (c.availability === "OUTSIDE") return `${c.displayName} không có lịch rảnh khung này. Vẫn lưu?`;
  return null;
}

/**
 * Tìm người dạy thay cho một buổi. `onPick` nhận người đã chọn (sau khi xác nhận nếu ngoài lịch rảnh).
 * Không truyền `onPick` thì chọn xong sẽ lưu luôn vào buổi học.
 */
export function SubstituteModal({
  session,
  onClose,
  onPick,
  onSaved,
}: {
  session: SubstituteTarget | null;
  onClose: () => void;
  onPick?: (c: Candidate) => void;
  onSaved?: () => void;
}) {
  const { message, modal } = App.useApp();
  const { data, loading } = useApi<Candidate[]>(session ? `/api/sessions/${session.id}/substitutes` : null);
  const [saving, setSaving] = useState<number | null>(null);

  const save = async (c: Candidate) => {
    if (onPick) {
      onPick(c);
      return;
    }
    setSaving(c.id);
    try {
      await api(`/api/sessions/${session!.id}`, { method: "PATCH", body: { action: "change", teacherId: c.id } });
      message.success(`${c.displayName} dạy thay ${session!.classCode} ${formatDateVN(session!.date)}`);
      onSaved?.();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const choose = (c: Candidate) => {
    const warn = candidateWarning(c);
    if (!warn) return void save(c);
    modal.confirm({ title: warn, okText: "Vẫn chọn", cancelText: "Chọn người khác", onOk: () => save(c) });
  };

  return (
    <Modal
      open={!!session}
      width={560}
      title={session ? `Tìm người dạy thay · ${session.classCode} · ${formatDateVN(session.date, true)} ${session.startTime}–${session.endTime}` : ""}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      destroyOnHidden
    >
      {loading && !data ? (
        <Skeleton active />
      ) : (
        <List
          dataSource={data ?? []}
          locale={{ emptyText: "Không có giáo viên nào đang làm." }}
          renderItem={(c) => (
            <List.Item
              actions={[
                c.current ? (
                  <Tag key="cur">Đang dạy buổi này</Tag>
                ) : (
                  <Button key="pick" size="small" type={c.blocked || c.onLeave ? "default" : "primary"} disabled={c.blocked} loading={saving === c.id} onClick={() => choose(c)}>
                    Chọn
                  </Button>
                ),
              ]}
            >
              <List.Item.Meta
                title={
                  <span>
                    {c.displayName} <span className="sub">{c.fullName}</span>
                  </span>
                }
                description={<CandidateTags c={c} />}
              />
            </List.Item>
          )}
        />
      )}
      <div className="sub" style={{ marginTop: 8 }}>
        Sắp theo mức phù hợp: rảnh, dạy ở trung tâm này, đã dạy khóa này. Người đang dạy lớp khác ở trung tâm khác cùng giờ không chọn được.
      </div>
    </Modal>
  );
}
