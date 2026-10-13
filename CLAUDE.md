# Quy tắc cho AI agent làm việc trong repo này

File này dùng chung cho **Claude Code (NOVA)** và **Antigravity** (`AGENTS.md` trỏ về đây). Hai công cụ thay nhau làm cùng một danh sách việc, nên mọi trạng thái phải nằm trong repo, không nằm trong trí nhớ của công cụ.

## Dự án

Phần mềm quản lý 4 trung tâm tiếng Anh. Một app Next.js 15 (App Router, React 19) + Prisma 6 + TypeScript. SQLite khi chạy máy, PostgreSQL khi đưa lên mạng. Giao diện GitHub Primer React. Người dùng là nhân sự trung tâm, giao diện và nội dung bằng tiếng Việt.

- Kế hoạch: `docs/KE_HOACH.md` (mục 2 là bảng việc còn thiếu, mục 3 là cách đợt A đã làm, dùng làm mẫu)
- Quy tắc giao diện: `docs/DESIGN.md`
- **Danh sách việc và nhật ký bàn giao: `docs/TIEN_DO.md`** (đọc đầu tiên, cập nhật sau mỗi việc)

## Quy trình mỗi lần bắt đầu

1. Đọc `docs/TIEN_DO.md`, phần "Bàn giao" và danh sách việc.
2. `git status`. Nếu có thay đổi chưa commit của lần trước: đọc ghi chú bàn giao, kiểm tra rồi làm tiếp, không xóa.
3. Chọn việc đầu tiên có trạng thái `[ ]` hoặc `[~]` (đang dở), theo đúng thứ tự trong file.

## Quy trình mỗi việc

1. Đổi trạng thái việc sang `[~]` trong `docs/TIEN_DO.md`.
2. Đọc mô tả của việc trong `docs/TIEN_DO.md` và `docs/KE_HOACH.md`, đọc code liên quan trước khi sửa. Mô tả chỉ có một dòng thì chọn cách đơn giản nhất khớp với code hiện có, ghi quyết định vào Nhật ký.
3. Làm. Đổi schema Prisma thì chạy `npx prisma db push` và cập nhật `prisma/seed.ts` nếu cần dữ liệu mẫu.
4. Kiểm tra: `npm run lint && npm run typecheck && npm test`. Phải xanh. Thêm test Vitest cho logic mới.
5. Đổi trạng thái sang `[x]`, ghi một dòng vào "Nhật ký" (ngày, việc, công cụ, file chính).
6. Commit ngay, mỗi việc một commit: `git add -A && git commit -m "feat(A1): ..."`.

Việc lớn chưa xong mà phải dừng: commit phần đã chạy được với tiền tố `wip(Ax):`, giữ `[~]`, và ghi vào phần "Bàn giao" đã làm gì, còn gì, đang vướng gì. Công cụ sau sẽ đọc đúng chỗ này.

## Luật code

- **Giao diện một nguồn:** màn hình chỉ import component từ `@/client/primer-compat`, icon từ `@/client/primer-icons`. Không import `@primer/react` hay `antd` trực tiếp (trừ AppShell, PrimerGrid, PrimerModal, Providers, ui.tsx). Không viết mã màu hex: dùng `var(--fgColor-…)`, `var(--bgColor-…)`, `var(--borderColor-…)` hoặc `COLORS`/`tint()` trong `src/lib/colors.ts`. ESLint báo lỗi nếu vi phạm.
- **Phân quyền:** 4 vai trò, kiểm tra ở cả API và giao diện, dùng `src/lib/permissions.ts`. Mọi thay đổi dữ liệu ghi nhật ký qua `src/server/audit.ts`.
- Làm theo cách các màn hình hiện có đang làm (xem file gần nhất cùng loại rồi viết giống vậy).
- Chữ hiển thị bằng tiếng Việt có dấu, ngắn gọn.
- Không thêm thư viện mới nếu chưa thật cần; nếu thêm, ghi lý do vào Nhật ký.
- Không sửa `.env`, không commit bí mật hay API key.
- Không `git push --force`, không xóa nhánh, không sửa lịch sử commit.
