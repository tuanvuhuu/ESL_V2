// B7: ghi file .xlsx thật (không cần thư viện): XLSX là file ZIP chứa vài file XML, ở đây đóng gói kiểu "store" (không nén).
// Dùng được cả ở trình duyệt lẫn Node. Chuỗi ghi dạng inlineStr nên không cần sharedStrings.

export type XlsxCell = string | number | null | undefined;
export type XlsxSheet = { name: string; header: string[]; rows: XlsxCell[][] };

const encoder = new TextEncoder();

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const xmlEscape = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Tên cột kiểu Excel: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Tên sheet hợp lệ của Excel: tối đa 31 ký tự, không chứa : \ / ? * [ ] */
export function safeSheetName(name: string, fallback: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
  return cleaned || fallback;
}

function sheetXml(sheet: XlsxSheet): string {
  const cell = (v: XlsxCell, c: number, r: number, bold: boolean) => {
    const ref = `${columnName(c)}${r}`;
    const style = bold ? ' s="1"' : "";
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
    return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(v))}</t></is></c>`;
  };
  const rowXml = (cells: XlsxCell[], r: number, bold: boolean) => `<row r="${r}">${cells.map((v, c) => cell(v, c, r, bold)).join("")}</row>`;
  const widths = sheet.header.map((h, c) => {
    const longest = Math.max(h.length, ...sheet.rows.map((row) => String(row[c] ?? "").length));
    return `<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, Math.max(10, longest + 2))}" customWidth="1"/>`;
  });
  const body = [rowXml(sheet.header, 1, true), ...sheet.rows.map((row, i) => rowXml(row, i + 2, false))].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.join("")}</cols><sheetData>${body}</sheetData></worksheet>`;
}

type ZipFile = { name: string; data: Uint8Array };

function zip(files: ZipFile[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const f of files) {
    const name = encoder.encode(f.name);
    const crc = crc32(f.data);
    // 0x0800: tên file là UTF-8; giờ ngày cố định 1980-01-01 để file giống nhau giữa các lần xuất.
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0)];
    const local = new Uint8Array([...u32(0x04034b50), ...common, ...name]);
    parts.push(local, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + f.data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** Tạo nội dung file .xlsx từ một hoặc nhiều sheet (dòng đầu in đậm, cố định khi cuộn). */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error("Cần ít nhất một sheet");
  const names = sheets.map((s, i) => safeSheetName(s.name, `Sheet${i + 1}`));
  const files: ZipFile[] = [
    {
      name: "[Content_Types].xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("")}</Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
          .map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join("")}</sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
          .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/styles.xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
      ),
    },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: encoder.encode(sheetXml(s)) })),
  ];
  return zip(files);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
