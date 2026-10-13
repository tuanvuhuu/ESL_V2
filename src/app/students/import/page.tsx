"use client";

import { CheckOutlined, DownloadOutlined, UploadOutlined } from "@/client/primer-icons";
import { Alert, App, Button, Space, Steps, Table, Tag } from "@/client/primer-compat";
import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/client/api";
import { PageHeader } from "@/components/ui";
import { IMPORT_COLUMNS, parseCsv, parseDateCell, tableToRows, templateCsv, type RawCell, type RawRow } from "@/lib/importer";

type Checked = { line: number; fullName: string; row: unknown; errors: string[]; notes: string[] };

/** Ô Excel kiểu ngày đổi thành "yyyy-mm-dd" trước khi gửi lên máy chủ. */
const plain = (v: RawCell) => (v instanceof Date ? parseDateCell(v) : v ?? null);

async function readTable(file: File): Promise<RawCell[][]> {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(file)) as RawCell[][];
}

/** Nhập học sinh đang học từ Excel (M15): tải file mẫu → chọn file → kiểm tra từng dòng → nhập các dòng hợp lệ. */
export default function ImportStudentsPage() {
  const { message } = App.useApp();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [checked, setChecked] = useState<Checked[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ created: number; skipped: number } | null>(null);

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "Mau_nhap_hoc_sinh.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pick = async (file: File) => {
    setFileName(file.name);
    setChecked(null);
    setDone(null);
    setProblem(null);
    setBusy(true);
    try {
      const { rows: parsed, missing } = tableToRows(await readTable(file));
      if (missing.length) {
        setProblem(`File thiếu cột bắt buộc: ${missing.join(", ")}. Dùng đúng tiêu đề như file mẫu.`);
        return;
      }
      if (parsed.length === 0) {
        setProblem("File không có dòng dữ liệu nào dưới dòng tiêu đề.");
        return;
      }
      const clean = parsed.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v)])) as RawRow);
      setRows(clean);
      const res = await api<{ checked: Checked[] }>("/api/import/students", { body: { dryRun: true, rows: clean } });
      setChecked(res.checked);
    } catch (e) {
      setProblem(`Không đọc được file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const valid = checked?.filter((c) => c.row).length ?? 0;
  const run = async () => {
    setBusy(true);
    try {
      const res = await api<{ created: number; skipped: number; checked: Checked[] }>("/api/import/students", { body: { dryRun: false, rows } });
      setDone({ created: res.created, skipped: res.skipped });
      setChecked(res.checked);
      message.success(`Đã nhập ${res.created} học sinh`);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Nhập học sinh từ Excel" description="Chuyển học sinh đang học, số buổi còn lại và công nợ từ file Excel cũ" />
      <div className="panel" style={{ marginBottom: 16 }}>
        <Steps
          size="small"
          current={done ? 3 : checked ? 2 : fileName ? 1 : 0}
          items={[{ title: "Tải file mẫu" }, { title: "Chọn file đã điền" }, { title: "Kiểm tra" }, { title: "Nhập" }]}
        />
        <Space wrap style={{ marginTop: 16 }}>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
            Tải file mẫu
          </Button>
          <Button type="primary" icon={<UploadOutlined />} loading={busy && !checked} onClick={() => input.current?.click()}>
            Chọn file .xlsx hoặc .csv
          </Button>
          {fileName && <span className="sub">{fileName}</span>}
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
            }}
          />
        </Space>
        <div className="sub" style={{ marginTop: 12 }}>
          Cột bắt buộc: {IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.header).join(", ")}. Có <b>Mã lớp</b> thì học sinh được xếp vào lớp từ hôm nay với số
          buổi đã mua = <b>Số buổi còn lại</b>; có <b>Còn nợ</b> thì số tiền đó hiện trong Công nợ. Không có mã lớp thì học sinh ở trạng thái Chờ xếp lớp.
          Học sinh trùng tên và ngày sinh với hồ sơ đã có sẽ bị bỏ qua; phụ huynh trùng SĐT dùng lại hồ sơ cũ.
        </div>
      </div>

      {problem && <Alert type="error" showIcon message={problem} style={{ marginBottom: 16 }} />}
      {done && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Đã nhập ${done.created} học sinh${done.skipped ? `, bỏ qua ${done.skipped} dòng lỗi` : ""}.`}
          description={<Link href="/students">Mở danh sách học sinh</Link>}
        />
      )}

      {checked && (
        <div className="panel">
          <Space wrap style={{ marginBottom: 12 }}>
            <b>
              {valid}/{checked.length} dòng hợp lệ
            </b>
            {checked.length - valid > 0 && <Tag color="red">{checked.length - valid} dòng lỗi sẽ bị bỏ qua</Tag>}
            {!done && (
              <Button type="primary" icon={<CheckOutlined />} disabled={valid === 0} loading={busy} onClick={run}>
                Nhập {valid} học sinh
              </Button>
            )}
          </Space>
          <Table<Checked>
            rowKey="line"
            pagination={false}
            dataSource={checked}
            columns={[
              { title: "Dòng", dataIndex: "line", width: 60 },
              { title: "Học sinh", dataIndex: "fullName" },
              {
                title: "Kết quả",
                render: (_, c) =>
                  c.errors.length ? (
                    <span style={{ color: "var(--fgColor-danger)" }}>{c.errors.join("; ")}</span>
                  ) : (
                    <span>
                      <Tag color="green">Hợp lệ</Tag>
                      {c.notes.length > 0 && <span className="sub">{c.notes.join("; ")}</span>}
                    </span>
                  ),
              },
            ]}
          />
        </div>
      )}
    </>
  );
}
