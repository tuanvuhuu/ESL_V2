"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Col, Descriptions, Dropdown, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Skeleton, Space, Table, Tabs, Tag } from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api, qs, useApi, useDebounced } from "@/client/api";
import { useViewer } from "@/client/session";
import type { Balance, Course, Room, SessionRow, StudentRow, Teacher } from "@/client/types";
import { BalanceCell } from "@/components/attendance/parts";
import { AuditTimeline } from "@/components/AuditTimeline";
import { BulkModal, type BulkTarget } from "@/components/classes/BulkModal";
import { SessionModal } from "@/components/classes/SessionModal";
import { OutcomeTag } from "@/components/history/CourseHistory";
import { OutcomeModal, type OutcomeTarget } from "@/components/history/OutcomeModal";
import { TransferModal, type TransferSource } from "@/components/classes/TransferModal";
import { CenterTag, Dash, PageHeader, StatusTag } from "@/components/ui";
import { CLASS_STATUSES, STUDENT_STATUSES, weekdayText } from "@/lib/constants";
import { ageFrom, formatDateVN, todayISO } from "@/lib/dates";
import { canEditCenter, canSeeAudit, canSeeTeachers, canWriteOutcome } from "@/lib/permissions";

type Detail = {
  id: number;
  code: string;
  name: string;
  status: string;
  weekdays: string;
  startTime: string;
  endTime: string;
  startDate: string;
  totalSessions: number;
  maxStudents: number;
  note: string | null;
  centerId: number;
  center: { id: number; name: string; color: string };
  room: Room;
  course: Course | null;
  teacher: { id: number; displayName: string; fullName: string };
  assistants: { teacherId: number; teacher: { id: number; displayName: string } }[];
  sessions: SessionRow[];
  enrollments: {
    id: number;
    joinedAt: string;
    leftAt: string | null;
    purchasedSessions: number | null;
    adjustment: number;
    adjustmentNote: string | null;
    outcome: string | null;
    finalComment: string | null;
    balance: Balance | null;
    student: { id: number; code: string; fullName: string; englishName: string | null; status: string; dob: string; centerId: number };
  }[];
};

function AddStudentModal({
  classId,
  courseId,
  defaultSessions,
  open,
  onClose,
  onSaved,
}: {
  classId: number;
  courseId: number | null;
  defaultSessions: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [studentId, setStudentId] = useState<number>();
  const [purchased, setPurchased] = useState<number | null>(defaultSessions);
  const [saving, setSaving] = useState(false);
  const { data } = useApi<{ items: StudentRow[] }>(open ? `/api/students${qs({ q: dq, pageSize: 20 })}` : null);
  // Học sinh đang chờ xếp lớp của khóa này (L3 bước 4) hiện đầu danh sách.
  const { data: waiting } = useApi<{ items: StudentRow[] }>(open && courseId ? `/api/students${qs({ waitingCourseId: courseId, pageSize: 100 })}` : null);
  const label = (s: StudentRow) => `${s.fullName} · ${s.code} · ${s.center.name} · ${STUDENT_STATUSES.find((x) => x.value === s.status)?.label}`;
  const waitingIds = new Set((waiting?.items ?? []).map((s) => s.id));

  const submit = async () => {
    if (!studentId) return;
    setSaving(true);
    try {
      await api(`/api/classes/${classId}/enrollments`, { body: { studentId, purchasedSessions: purchased ?? defaultSessions } });
      message.success("Đã xếp học sinh vào lớp");
      setStudentId(undefined);
      setPurchased(defaultSessions);
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Xếp học sinh vào lớp" onCancel={onClose} onOk={submit} okText="Xếp lớp" cancelText="Hủy" confirmLoading={saving} okButtonProps={{ disabled: !studentId }} destroyOnHidden>
      <Form layout="vertical">
        <Form.Item label="Học sinh" extra="Gõ tên, mã hoặc SĐT phụ huynh.">
          <Select
            showSearch
            autoFocus
            filterOption={false}
            onSearch={setQ}
            value={studentId}
            onChange={setStudentId}
            placeholder="Tìm học sinh"
            options={[
              ...(waiting?.items.length && !dq
                ? [{ label: `Đang chờ lớp khóa này (${waiting.items.length})`, options: waiting.items.map((s) => ({ value: s.id, label: label(s) })) }]
                : []),
              {
                label: dq ? "Kết quả tìm" : "Học sinh khác",
                options: (data?.items ?? []).filter((s) => dq || !waitingIds.has(s.id)).map((s) => ({ value: s.id, label: label(s) })),
              },
            ]}
          />
        </Form.Item>
        <Form.Item label="Số buổi đã mua" extra="Mặc định bằng số buổi của lớp. Số buổi còn lại tự trừ khi điểm danh.">
          <InputNumber min={0} max={500} value={purchased} onChange={setPurchased} style={{ width: 160 }} addonAfter="buổi" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

type EnrollmentEdit = { id: number; name: string; purchasedSessions: number; adjustment: number; adjustmentNote: string | null };

/** Sửa số buổi đã mua và điều chỉnh tay (kèm lý do). */
function SessionsModal({ classId, value, onClose, onSaved }: { classId: number; value: EnrollmentEdit | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      open={!!value}
      title={value ? `Số buổi · ${value.name}` : ""}
      okText="Lưu"
      cancelText="Hủy"
      onCancel={onClose}
      confirmLoading={saving}
      destroyOnHidden
      onOk={() => form.submit()}
    >
      {value && (
        <Form
          form={form}
          layout="vertical"
          initialValues={value}
          onFinish={async (v) => {
            setSaving(true);
            try {
              await api(`/api/classes/${classId}/enrollments/${value.id}`, { method: "PATCH", body: { ...v, adjustment: v.adjustment ?? 0 } });
              message.success("Đã cập nhật số buổi");
              onSaved();
            } catch (e) {
              message.error((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="purchasedSessions" label="Số buổi đã mua" rules={[{ required: true, message: "Nhập số buổi đã mua" }]}>
            <InputNumber min={0} max={500} style={{ width: 160 }} addonAfter="buổi" />
          </Form.Item>
          <Form.Item name="adjustment" label="Điều chỉnh tay" extra="Số dương: cộng thêm (tặng buổi, chuyển từ khóa trước). Số âm: trừ bớt.">
            <InputNumber min={-500} max={500} style={{ width: 160 }} addonAfter="buổi" />
          </Form.Item>
          <Form.Item
            name="adjustmentNote"
            label="Lý do điều chỉnh"
            dependencies={["adjustment"]}
            rules={[({ getFieldValue }) => ({ required: !!getFieldValue("adjustment"), message: "Ghi lý do điều chỉnh" })]}
          >
            <Input maxLength={200} placeholder="VD: Tặng 2 buổi khi đăng ký sớm" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { message, modal } = App.useApp();
  const viewer = useViewer();
  const { data: c, loading, reload } = useApi<Detail>(`/api/classes/${id}`);
  const editable = !!c && canEditCenter(viewer, c.centerId);
  const { data: teachers } = useApi<Teacher[]>(editable ? "/api/teachers" : null);
  const teacherLink = (t: { id: number; displayName: string }) =>
    canSeeTeachers(viewer) || t.id === viewer.teacherId ? <Link href={`/teachers/${t.id}`}>{t.displayName}</Link> : t.displayName;
  const [adding, setAdding] = useState(false);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [editAssist, setEditAssist] = useState<number[] | null>(null);
  const [editSessions, setEditSessions] = useState<EnrollmentEdit | null>(null);
  const [transfer, setTransfer] = useState<TransferSource | null>(null);
  const [bulk, setBulk] = useState<BulkTarget | null>(null);
  const [outcome, setOutcome] = useState<OutcomeTarget | null>(null);

  if (loading && !c) return <Skeleton active />;
  if (!c) return <Empty description="Không tìm thấy lớp" />;

  const active = c.enrollments.filter((e) => !e.leftAt);
  const today = todayISO();
  const done = c.sessions.filter((s) => s.status === "SCHEDULED" && s.date < today).length;
  const scheduled = c.sessions.filter((s) => s.status === "SCHEDULED").length;
  const writeOutcome = canWriteOutcome(viewer, c.centerId, c.teacher.id);
  const open = c.status !== "FINISHED" && c.status !== "CANCELLED";
  const openBulk = (action: BulkTarget["action"]) =>
    setBulk({
      action,
      classId: c.id,
      classCode: c.code,
      centerId: c.centerId,
      teacherId: c.teacher.id,
      assistantIds: c.assistants.map((a) => a.teacherId),
      upcoming: c.sessions.filter((s) => s.status === "SCHEDULED" && s.date >= today && !s.attendanceTakenAt).map((s) => s.date),
    });

  const update = async (body: Record<string, unknown>, ok: string) => {
    try {
      await api(`/api/classes/${c.id}`, { method: "PUT", body });
      message.success(ok);
      void reload();
      return true;
    } catch (e) {
      message.error((e as Error).message);
      return false;
    }
  };

  const leave = async (enrollmentId: number) => {
    try {
      await api(`/api/classes/${c.id}/enrollments/${enrollmentId}`, { method: "DELETE" });
      message.success("Học sinh đã rời lớp");
      void reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const overview = (
    <Row gutter={[16, 16]}>
      {c.status === "FINISHED" && (
        <Col span={24}>
          <Alert
            type="info"
            showIcon
            message="Lớp đã kết thúc"
            description={`${active.filter((e) => e.outcome).length}/${active.length} học sinh đã có kết quả cuối khóa. Ghi kết quả và tư vấn khóa tiếp ở tab Học sinh; học sinh chưa có lớp mới hiện ở mục "Tư vấn khóa tiếp" trang Hôm nay.`}
          />
        </Col>
      )}
      <Col xs={24} lg={14}>
        <Card size="small" title="Thông tin lớp">
          <Descriptions column={{ xs: 1, md: 2 }} size="small">
            <Descriptions.Item label="Khóa">{c.course?.name ?? <Dash />}</Descriptions.Item>
            <Descriptions.Item label="Trung tâm">
              <CenterTag center={c.center} />
            </Descriptions.Item>
            <Descriptions.Item label="Lịch">
              {weekdayText(c.weekdays)} · {c.startTime}–{c.endTime}
            </Descriptions.Item>
            <Descriptions.Item label="Phòng">
              {c.room.name} ({c.room.capacity} chỗ)
            </Descriptions.Item>
            <Descriptions.Item label="Khai giảng">{formatDateVN(c.startDate)}</Descriptions.Item>
            <Descriptions.Item label="Sĩ số">
              {active.length}/{c.maxStudents}
            </Descriptions.Item>
            <Descriptions.Item label="Tiến độ">
              {done}/{scheduled} buổi đã diễn ra
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú">{c.note ?? <Dash />}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card
          size="small"
          title="Giáo viên & trợ giảng"
          extra={
            editable && (
              <Button size="small" onClick={() => setEditAssist(c.assistants.map((a) => a.teacherId))}>
                Sửa trợ giảng
              </Button>
            )
          }
        >
          <div>
            Giáo viên chính: {teacherLink(c.teacher)}
          </div>
          <div style={{ marginTop: 8 }}>
            Trợ giảng:{" "}
            {c.assistants.length
              ? c.assistants.map((a) => (
                  <Tag key={a.teacherId}>{teacherLink(a.teacher)}</Tag>
                ))
              : <Dash />}
          </div>
          {editable && (
            <div className="sub" style={{ marginTop: 8 }}>
              Đổi giáo viên cho từng buổi (dạy thay) ở tab Buổi học.
            </div>
          )}
          {editable && open && (
            <Space wrap style={{ marginTop: 12 }}>
              <Button size="small" onClick={() => openBulk("teacher")}>
                Đổi giáo viên từ ngày…
              </Button>
              <Button size="small" onClick={() => openBulk("shift")}>
                Dời lịch từ ngày…
              </Button>
            </Space>
          )}
        </Card>
      </Col>
    </Row>
  );

  const students = (
    <>
      <div className="filter-bar">
        <span className="sub">
          {active.length}/{Math.min(c.maxStudents, c.room.capacity)} chỗ đã dùng
        </span>
        <div className="spacer" />
        {editable && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
            Xếp học sinh
          </Button>
        )}
      </div>
      <Table
        rowKey="id"
        pagination={false}
        dataSource={c.enrollments}
        locale={{ emptyText: "Chưa có học sinh nào trong lớp. Thêm học sinh để bắt đầu." }}
        columns={[
          { title: "Mã", render: (_, e) => e.student.code },
          {
            title: "Học sinh",
            render: (_, e) => (
              <>
                <Link href={`/students/${e.student.id}`}>{e.student.fullName}</Link> {e.student.englishName && <span className="sub">{e.student.englishName}</span>}
              </>
            ),
          },
          { title: "Tuổi", render: (_, e) => ageFrom(e.student.dob) },
          { title: "Trạng thái", render: (_, e) => <StatusTag options={STUDENT_STATUSES} value={e.student.status} /> },
          { title: "Vào lớp", render: (_, e) => formatDateVN(e.joinedAt) },
          { title: "Rời lớp", render: (_, e) => (e.leftAt ? formatDateVN(e.leftAt) : <Dash />) },
          { title: "Buổi còn lại", render: (_, e) => <BalanceCell balance={e.balance} warn={!e.leftAt} /> },
          {
            title: "Kết quả",
            render: (_, e) => (
              <>
                <OutcomeTag value={e.outcome} />
                {e.finalComment && (
                  <div className="sub" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.finalComment}>
                    {e.finalComment}
                  </div>
                )}
                {!e.outcome && !e.finalComment && <Dash />}
              </>
            ),
          },
          {
            title: "",
            render: (_, e) =>
              (editable || writeOutcome) && (
                <Space size={0}>
                  {writeOutcome && (
                    <Button
                      size="small"
                      type="text"
                      onClick={() =>
                        setOutcome({ classId: c.id, enrollmentId: e.id, studentName: e.student.fullName, classCode: c.code, outcome: e.outcome, finalComment: e.finalComment })
                      }
                    >
                      Kết quả
                    </Button>
                  )}
                  {editable && (
                  <>
                  <Button
                    size="small"
                    type="text"
                    onClick={() =>
                      setEditSessions({
                        id: e.id,
                        name: e.student.fullName,
                        purchasedSessions: e.purchasedSessions ?? c.totalSessions,
                        adjustment: e.adjustment,
                        adjustmentNote: e.adjustmentNote,
                      })
                    }
                  >
                    Số buổi
                  </Button>
                  {!e.leftAt && (
                    <Button
                      size="small"
                      type="text"
                      onClick={() =>
                        setTransfer({
                          enrollmentId: e.id,
                          classId: c.id,
                          classCode: c.code,
                          courseId: c.course?.id ?? null,
                          studentName: e.student.fullName,
                          studentCenterId: e.student.centerId,
                          remaining: e.balance?.remaining ?? null,
                        })
                      }
                    >
                      Chuyển lớp
                    </Button>
                  )}
                  {!e.leftAt && (
                    <Popconfirm title={`${e.student.fullName} rời lớp ${c.code}?`} okText="Rời lớp" cancelText="Hủy" onConfirm={() => leave(e.id)}>
                      <Button size="small" danger type="text">
                        Rời lớp
                      </Button>
                    </Popconfirm>
                  )}
                  </>
                  )}
                </Space>
              ),
          },
        ]}
      />
    </>
  );

  const sessions = (
    <Table<SessionRow>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={c.sessions}
      scroll={{ x: "max-content" }}
      rowClassName={(s) => (s.status === "CANCELLED" ? "row-cancelled" : "")}
      columns={[
        { title: "Buổi", dataIndex: "index", width: 60 },
        {
          title: "Ngày",
          render: (_, s) => (
            <span style={{ textDecoration: s.status === "CANCELLED" ? "line-through" : undefined, fontWeight: s.date === today ? 600 : undefined }}>
              {formatDateVN(s.date, true)}
            </span>
          ),
        },
        { title: "Giờ", render: (_, s) => `${s.startTime}–${s.endTime}` },
        { title: "Phòng", render: (_, s) => s.room.name },
        {
          title: "Người dạy",
          render: (_, s) => (
            <>
              {s.teacher.displayName} {s.teacherId !== c.teacher.id && <Tag color="purple">Dạy thay</Tag>}
            </>
          ),
        },
        {
          title: "Trạng thái",
          render: (_, s) =>
            s.status === "CANCELLED" ? (
              <Tag color="red">Đã hủy</Tag>
            ) : s.date < today ? (
              <Tag>Đã diễn ra</Tag>
            ) : (
              <Tag color="blue">Sắp diễn ra</Tag>
            ),
        },
        {
          title: "Điểm danh",
          render: (_, s) =>
            s.status === "CANCELLED" ? (
              <Dash />
            ) : s.attendanceTakenAt ? (
              <Link href={`/sessions/${s.id}`}>
                <Tag color="green">Đã điểm danh</Tag>
              </Link>
            ) : s.date <= today ? (
              <Link href={`/sessions/${s.id}`}>
                <Tag color="orange">Chưa điểm danh</Tag>
              </Link>
            ) : s._count?.makeups ? (
              <Tag color="purple">{s._count.makeups} học bù</Tag>
            ) : (
              <Dash />
            ),
        },
        { title: "Nội dung đã dạy", render: (_, s) => s.lessonContent ?? <Dash /> },
        { title: "Ghi chú", render: (_, s) => s.note ?? <Dash /> },
        ...(editable
          ? [
              {
                title: "",
                render: (_: unknown, s: SessionRow) => (
                  <Button size="small" onClick={() => setSession(s)}>
                    {s.status === "CANCELLED" ? "Xem" : "Đổi / hủy"}
                  </Button>
                ),
              },
            ]
          : []),
      ]}
    />
  );

  return (
    <>
      <PageHeader
        title={
          <Space>
            {c.name}
            <StatusTag options={CLASS_STATUSES} value={c.status} />
          </Space>
        }
        description={`${c.code} · ${c.center.name} · ${c.teacher.displayName}`}
        actions={
          editable && (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: CLASS_STATUSES.filter((s) => s.value !== c.status).map((s) => ({
                key: s.value,
                label: s.label,
                danger: s.value === "CANCELLED",
                onClick: () => {
                  if (s.value === "CANCELLED") {
                    modal.confirm({
                      title: `Hủy lớp ${c.code}?`,
                      content: "Các buổi chưa diễn ra sẽ bị hủy. Thao tác được lưu vào lịch sử.",
                      okText: "Hủy lớp",
                      okButtonProps: { danger: true },
                      cancelText: "Không",
                      onOk: () => update({ status: s.value }, `Đã hủy lớp ${c.code}`),
                    });
                  } else void update({ status: s.value }, `${c.code}: ${s.label}`);
                },
              })),
            }}
          >
            <Button>Đổi trạng thái lớp</Button>
          </Dropdown>
          )
        }
      />
      <div className="panel">
        <Tabs
          items={[
            { key: "overview", label: "Tổng quan", children: overview },
            { key: "students", label: `Học sinh (${active.length})`, children: students },
            { key: "sessions", label: `Buổi học (${c.sessions.length})`, children: sessions },
            ...(canSeeAudit(viewer) ? [{ key: "audit", label: "Lịch sử thay đổi", children: <AuditTimeline entity="Class" id={c.id} /> }] : []),
          ]}
        />
      </div>
      <SessionsModal
        classId={c.id}
        value={editSessions}
        onClose={() => setEditSessions(null)}
        onSaved={() => {
          setEditSessions(null);
          void reload();
        }}
      />
      <BulkModal
        target={bulk}
        teachers={teachers ?? []}
        onClose={() => setBulk(null)}
        onSaved={() => {
          setBulk(null);
          void reload();
        }}
      />
      <OutcomeModal
        target={outcome}
        onClose={() => setOutcome(null)}
        onSaved={() => {
          setOutcome(null);
          void reload();
        }}
      />
      <AddStudentModal
        classId={c.id}
        courseId={c.course?.id ?? null}
        defaultSessions={c.totalSessions}
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          void reload();
        }}
      />
      <TransferModal
        source={transfer}
        onClose={() => setTransfer(null)}
        onSaved={() => {
          setTransfer(null);
          void reload();
        }}
      />
      <SessionModal
        open={!!session}
        session={session ? { ...session, classCode: c.code, centerId: c.centerId, studentCount: active.length } : null}
        onClose={() => setSession(null)}
        onSaved={() => {
          setSession(null);
          void reload();
        }}
      />
      <Modal
        open={editAssist !== null}
        title={`Trợ giảng · ${c.code}`}
        okText="Lưu"
        cancelText="Hủy"
        onCancel={() => setEditAssist(null)}
        onOk={async () => {
          if (await update({ assistantIds: editAssist ?? [] }, "Đã cập nhật trợ giảng")) setEditAssist(null);
        }}
      >
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          value={editAssist ?? []}
          onChange={(v) => setEditAssist(v.slice(0, 2))}
          optionFilterProp="label"
          options={(teachers ?? [])
            .filter((t) => t.status === "ACTIVE" && t.role !== "TEACHER" && t.id !== c.teacher.id && t.centers.some((x) => x.centerId === c.centerId))
            .map((t) => ({ value: t.id, label: `${t.displayName} · ${t.fullName}` }))}
        />
        <div className="sub" style={{ marginTop: 8 }}>
          Tối đa 2 trợ giảng. Áp dụng cho các buổi sắp tới; hệ thống kiểm tra trùng lịch.
        </div>
      </Modal>
    </>
  );
}
