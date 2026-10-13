# Quy tắc cho AI agent làm việc trong repo này

> **Đọc `docs/RULES.md` trước tiên.** Đó là luật chung (nhánh `common`, commit, dữ liệu). Chỗ nào trong file này khác với `docs/RULES.md` thì làm theo `docs/RULES.md`.

File này dùng chung cho **Claude Code (NOVA)** và **Antigravity** (`AGENTS.md` trỏ về đây). Hai công cụ thay nhau làm cùng một danh sách việc, nên mọi trạng thái phải nằm trong repo, không nằm trong trí nhớ của công cụ.

## Dự án

Phần mềm quản lý 4 trung tâm tiếng Anh. Một app Next.js 15 (App Router, React 19) + Prisma 6 + TypeScript. SQLite khi chạy máy, PostgreSQL khi đưa lên mạng. Giao diện GitHub Primer React. Người dùng là nhân sự trung tâm, giao diện và nội dung bằng tiếng Việt.

- Kế hoạch: `docs/KE_HOACH.md` (mục 2 là bảng việc còn thiếu, mục 3 là cách đợt A đã làm, dùng làm mẫu)
- Quy tắc giao diện: `docs/DESIGN.md`
- **Danh sách việc và nhật ký bàn giao: `docs/TIEN_DO.md`** (đọc đầu tiên, cập nhật sau mỗi việc)

## Quy trình mỗi lần bắt đầu

1. `git fetch origin && git checkout common && git pull origin common`.
2. Đọc `docs/TIEN_DO.md`, phần "Bàn giao" và danh sách việc.
3. `git status`. Nếu có thay đổi chưa commit của lần trước: đọc ghi chú bàn giao, kiểm tra rồi làm tiếp, không xóa.
4. Chọn việc đầu tiên có trạng thái `[ ]` hoặc `[~]` (đang dở), theo đúng thứ tự trong file.

## Quy trình mỗi việc

1. Đổi trạng thái việc sang `[~]` trong `docs/TIEN_DO.md`.
2. Đọc mô tả của việc trong `docs/TIEN_DO.md` và `docs/KE_HOACH.md`, đọc code liên quan trước khi sửa. Mô tả chỉ có một dòng thì chọn cách đơn giản nhất khớp với code hiện có, ghi quyết định vào Nhật ký.
3. Làm. Đổi schema Prisma thì **không** chạy `prisma db push`: sửa `prisma/schema.prisma`, chạy `npx prisma generate`, viết SQL vào `docs/sql/` và ghi vào Bàn giao để Tuấn tự chạy (xem `docs/RULES.md`).
4. Kiểm tra: `npm run lint && npm run typecheck && npm test`. Phải xanh. Thêm test Vitest cho logic mới.
5. Đổi trạng thái sang `[x]`, ghi một dòng vào "Nhật ký" (ngày, việc, công cụ, file chính), xóa mục Bàn giao của việc này nếu có.
6. Commit và push ngay, mỗi việc một commit: `git add -A && git commit -m "done(B1): ..." && git push origin common`.

Việc lớn chưa xong mà phải dừng: commit phần đã chạy được với tiền tố `wip(Bx):`, giữ `[~]`, ghi vào phần "Bàn giao" đã làm gì, còn gì, đang vướng gì, push lên `common` rồi dừng. Công cụ sau sẽ đọc đúng chỗ này.

## Luật code

- **Giao diện một nguồn:** màn hình chỉ import component từ `@/client/primer-compat`, icon từ `@/client/primer-icons`. Không import `@primer/react` hay `antd` trực tiếp (trừ AppShell, PrimerGrid, PrimerModal, Providers, ui.tsx). Không viết mã màu hex: dùng `var(--fgColor-…)`, `var(--bgColor-…)`, `var(--borderColor-…)` hoặc `COLORS`/`tint()` trong `src/lib/colors.ts`. ESLint báo lỗi nếu vi phạm.
- **Phân quyền:** 4 vai trò, kiểm tra ở cả API và giao diện, dùng `src/lib/permissions.ts`. Mọi thay đổi dữ liệu ghi nhật ký qua `src/server/audit.ts`.
- Làm theo cách các màn hình hiện có đang làm (xem file gần nhất cùng loại rồi viết giống vậy).
- Chữ hiển thị bằng tiếng Việt có dấu, ngắn gọn.
- Không thêm thư viện mới nếu chưa thật cần; nếu thêm, ghi lý do vào Nhật ký.
- Không sửa `.env`, không commit bí mật hay API key.
- Không chạy lệnh xóa dữ liệu (`npm run db:reset`, `--force-reset`, `migrate reset`).
- Không `git push --force`, không xóa nhánh, không sửa lịch sử commit.
