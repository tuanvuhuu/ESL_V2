import { z } from "zod";
import { IMPORT_COLUMNS, type RawRow } from "@/lib/importer";
import { canCreateRecords } from "@/lib/permissions";
import { prisma } from "@/server/db";
import { allow, body, route } from "@/server/http";
import { checkImport, runImport } from "@/server/importer";

const cell = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]).optional();
const schema = z.object({
  dryRun: z.boolean().default(true),
  rows: z
    .array(z.object(Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, cell])) as Record<(typeof IMPORT_COLUMNS)[number]["key"], typeof cell>))
    .min(1, "File không có dòng dữ liệu nào")
    .max(2000, "Mỗi lần nhập tối đa 2000 dòng"),
});

/** Nhập học sinh từ Excel: `dryRun` chỉ kiểm tra; không thì ghi các dòng hợp lệ. Quản lý và giáo vụ (trung tâm mình). */
export const POST = route(async (req, _ctx, viewer) => {
  allow(canCreateRecords(viewer), "Chỉ quản lý và giáo vụ được nhập dữ liệu");
  const { dryRun, rows } = await body(req, schema);
  if (dryRun) {
    const checked = await checkImport(prisma, rows as RawRow[], viewer);
    return { checked, valid: checked.filter((c) => c.row).length };
  }
  return runImport(rows as RawRow[], viewer);
});
