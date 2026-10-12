"use client";

import { PlusOutlined } from "@/client/primer-icons";
import { Button, Empty, Skeleton, Tag, Timeline } from "@/client/primer-compat";
import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { qs, useApi } from "@/client/api";
import { CONTACT_CHANNELS, optionOf } from "@/lib/constants";
import { formatDateVN, todayISO } from "@/lib/dates";
import { ContactModal, type ContactTarget } from "./ContactModal";

export type ContactRow = {
  id: number;
  channel: string;
  content: string;
  followUpDate: string | null;
  followUpNote: string | null;
  followUpDoneAt: string | null;
  followUpDoneBy: string | null;
  createdBy: string;
  createdAt: string;
  student: { id: number; code: string; fullName: string; centerId: number; center: { name: string; color: string } };
  parent: { id: number; fullName: string; phone: string } | null;
};

export function FollowUpTag({ c }: { c: Pick<ContactRow, "followUpDate" | "followUpDoneAt"> }) {
  if (!c.followUpDate) return null;
  if (c.followUpDoneAt) return <Tag>Đã gọi lại</Tag>;
  const today = todayISO();
  const color = c.followUpDate < today ? "red" : c.followUpDate === today ? "orange" : "blue";
  return <Tag color={color}>Hẹn gọi lại {formatDateVN(c.followUpDate)}</Tag>;
}

/**
 * Nhật ký liên lạc: của một học sinh (tab Liên lạc) hoặc cả gia đình một phụ huynh.
 * `newFor`: có thì hiện nút Ghi liên lạc cho học sinh đó.
 */
export function ContactList({ studentId, parentId, newFor }: { studentId?: number; parentId?: number; newFor?: Omit<ContactTarget, "followUp"> | null }) {
  const { data, loading, reload } = useApi<ContactRow[]>(`/api/contacts${qs({ studentId, parentId })}`);
  const [target, setTarget] = useState<ContactTarget | null>(null);
  if (loading && !data) return <Skeleton active />;
  return (
    <>
      {newFor && (
        <div className="filter-bar">
          <span className="sub">Gọi điện, nhắn Zalo, gặp trực tiếp với phụ huynh. Hẹn ngày gọi lại để không quên.</span>
          <div className="spacer" />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setTarget(newFor)}>
            Ghi liên lạc
          </Button>
        </div>
      )}
      {!data?.length ? (
        <Empty description="Chưa có lần liên lạc nào." />
      ) : (
        <Timeline
          items={data.map((c) => ({
            color: c.followUpDate && !c.followUpDoneAt ? "orange" : "blue",
            children: (
              <div>
                <div>
                  <b>{optionOf(CONTACT_CHANNELS, c.channel)?.label}</b>
                  {c.parent && ` với ${c.parent.fullName}`}
                  {parentId && (
                    <>
                      {" "}
                      về <Link href={`/students/${c.student.id}`}>{c.student.fullName}</Link>
                    </>
                  )}{" "}
                  <span className="sub">
                    · {dayjs(c.createdAt).format("DD/MM/YYYY HH:mm")} · {c.createdBy}
                  </span>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{c.content}</div>
                {c.followUpDate && (
                  <div style={{ marginTop: 4 }}>
                    <FollowUpTag c={c} /> <span className="sub">{c.followUpNote}</span>
                  </div>
                )}
              </div>
            ),
          }))}
        />
      )}
      <ContactModal
        target={target}
        onClose={() => setTarget(null)}
        onSaved={() => {
          setTarget(null);
          void reload();
        }}
      />
    </>
  );
}
