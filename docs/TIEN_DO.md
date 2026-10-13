# Tiến độ và bàn giao

Claude Code (NOVA) và Antigravity làm chung file này. Luật chung: `docs/RULES.md` (đọc trước). Quy trình: `CLAUDE.md`. Mọi commit vào nhánh `common`.

Trạng thái: `[ ]` chưa làm · `[~]` đang làm dở · `[x]` xong (lint, typecheck, test xanh, đã commit và push lên `common`)

## Đã xong trước khi chuyển sang NOVA / Antigravity

- [x] Đợt A (A1–A9): khung chương trình, tài liệu, buổi kiểm tra, điểm kỹ năng, mua thêm buổi, khóa tiếp theo, báo cáo học sinh, báo cáo phòng và lớp, nhập Excel. Ở PR #9. Chi tiết: `docs/KE_HOACH.md` mục 3. **Không làm lại.**

## Danh sách việc (làm theo thứ tự)

Mô tả từ `docs/KE_HOACH.md` mục 2. Mỗi việc một commit.

- [x] B1. Sửa giờ tính lương từng buổi bằng tay, bắt buộc ghi lý do, ghi nhật ký thay đổi
- [x] B2. Trợ giảng gắn theo từng buổi (hiện chỉ gắn cả lớp), có thời lượng có mặt riêng, dùng khi tính lương
- [ ] B3. Lương tự đưa vào chi phí của trung tâm nơi buổi dạy diễn ra (lãi lỗ hiện chia theo bảng lương)
- [ ] B4. Đổi cách tính trùng giờ có ngày hiệu lực; tháng lương đã chốt giữ nguyên cách cũ
- [ ] B5. Cấp độ dạy được của giáo viên, dùng khi gợi ý người dạy thay
- [ ] B6. Cảnh báo khi ghi danh học sinh còn nợ khóa trước; cảnh báo giáo viên dạy 2 trung tâm sát giờ
- [ ] B7. Báo cáo doanh thu theo ngày và theo trung tâm học (hiện theo trung tâm thu); xuất .xlsx thật thay CSV
- [ ] B8. Hoàn tất đợt B: `npm run build` xanh, cập nhật `README.md` và bảng mục 2 của `docs/KE_HOACH.md`

Đợt C chưa làm: C1 cần Tuấn chốt nơi lưu file khi đưa lên mạng, C2 cần Tuấn trả lời câu hỏi ở mục 7 tài liệu yêu cầu.

## Bàn giao

Công cụ nào dừng giữa chừng thì ghi vào đây: việc đang làm, đã xong phần nào, còn lại gì, lỗi đang gặp, file đang sửa. Công cụ sau làm tiếp xong thì xóa mục này.

**B1 đã xong về code, cần Tuấn chạy SQL:** chạy file `docs/sql/2026-10-13-B1-gio-luong-sua-tay.sql` lên `prisma/dev.db` rồi `npx prisma generate`. Chưa chạy thì `dev.db` thật thiếu cột `payrollMinutes/payrollNote` nên test B1 và màn lương sẽ lỗi. Đã kiểm tra trên bản sao dev.db.

B2 cũng cần SQL: `docs/sql/2026-10-13-B2-tro-giang-theo-buoi.sql` (thêm bảng `SessionAssistant`), chạy sau file B1.

Tiếp theo: B3.

## Nhật ký

| Ngày | Việc | Công cụ | Ghi chú |
|---|---|---|---|
| 13/10/2026 | B1 | Antigravity | Sửa giờ lương từng buổi kèm lý do: `src/server/payroll.ts`, route `api/sessions/[id]/payroll-hours`, `SessionDetailModal.tsx`, `tests/api-payroll-hours.test.ts`, SQL `docs/sql/2026-10-13-B1-gio-luong-sua-tay.sql`. Lint/typecheck/test xanh (167/167) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B2 | Antigravity | Trợ giảng theo từng buổi, có số phút riêng dùng khi tính lương (buổi có trợ giảng riêng thì bỏ trợ giảng cả lớp): bảng `SessionAssistant`, `src/server/payroll.ts`, route `api/sessions/[id]/assistants`, `tests/api-assistants.test.ts`, SQL `docs/sql/2026-10-13-B2-tro-giang-theo-buoi.sql`. Lint/typecheck/test xanh (171/171) trên bản sao dev.db đã áp SQL. |
