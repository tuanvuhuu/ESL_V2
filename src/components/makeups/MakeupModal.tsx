"use client";

import { Alert, App, Empty, Modal, Radio, Skeleton, Space, Tag } from "@/client/primer-compat";
import { useEffect, useState } from "react";
import { api, qs, useApi } from "@/client/api";
import { CenterTag } from "@/components/ui";
import { formatDateVN } from "@/lib/dates";

export type AbsenceLite = { id: number; studentName: string; classCode: string; date: string; index: number };

type Option = {
  id: number;
  index: number;
  date: string;
  startTime: string;
  endTime: string;
  seatsLeft: number;
  sameIndex: boolean;
  sameCenter: boolean;
  room: { name: string };
  teacher: { displayName: string };
  class: { id: number; code: string; name: string; center: { id: number; name: string; color: string } };
};

/** Xếp học bù (L6): gợi ý buổi cùng khóa, cùng buổi số, còn chỗ, ưu tiên trung tâm chính. */
export function MakeupModal({ absence, onClose, onSaved }: { absence: AbsenceLite | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const { data, loading } = useApi<Option[]>(absence ? `/api/makeups/options${qs({ absenceId: absence.id })}` : null);
  const [picked, setPicked] = useState<number>();
  const [saving, setSaving] = useState(false);

  useEffect(() => setPicked(undefined), [absence]);

  const submit = async () => {
    if (!absence || !picked) return;
    setSaving(true);
    try {
      await api("/api/makeups", { body: { absenceId: absence.id, sessionId: picked } });
      message.success(`Đã xếp học bù cho ${absence.studentName}`);
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!absence}
      title={absence ? `Xếp học bù · ${absence.studentName}` : ""}
      okText="Xếp học bù"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={submit}
      okButtonProps={{ disabled: !picked }}
      confirmLoading={saving}
      width={640}
      destroyOnHidden
    >
      {absence && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Vắng buổi ${absence.index} lớp ${absence.classCode} ngày ${formatDateVN(absence.date, true)}. Học sinh sẽ có trong danh sách điểm danh của buổi được chọn, kèm nhãn Học bù.`}
        />
      )}
      {loading && !data ? (
        <Skeleton active />
      ) : !data?.length ? (
        <Empty description="Không có buổi phù hợp còn chỗ (cùng khóa, từ hôm nay, không trùng giờ học của học sinh)." />
      ) : (
        <Radio.Group value={picked} onChange={(e) => setPicked(e.target.value)} style={{ width: "100%" }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            {data.map((o) => (
              <Radio key={o.id} value={o.id} style={{ width: "100%", padding: "6px 0", borderBottom: "1px solid var(--borderColor-muted)" }}>
                <b>{formatDateVN(o.date, true)}</b> {o.startTime}–{o.endTime} · <b>{o.class.code}</b> buổi {o.index} · phòng {o.room.name} ·{" "}
                {o.teacher.displayName} <CenterTag center={o.class.center} />
                {o.sameIndex && <Tag color="green">Cùng bài</Tag>}
                <Tag>Còn {o.seatsLeft} chỗ</Tag>
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      )}
    </Modal>
  );
}
