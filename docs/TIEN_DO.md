# Tiến độ và bàn giao

Claude Code (NOVA) và Antigravity làm chung file này. Luật chung: `docs/RULES.md` (đọc trước). Quy trình: `CLAUDE.md`. Mọi commit vào nhánh `common`.

Trạng thái: `[ ]` chưa làm · `[~]` đang làm dở · `[x]` xong (lint, typecheck, test xanh, đã commit và push lên `common`)

## Đã xong trước khi chuyển sang NOVA / Antigravity

- [x] Đợt A (A1–A9): khung chương trình, tài liệu, buổi kiểm tra, điểm kỹ năng, mua thêm buổi, khóa tiếp theo, báo cáo học sinh, báo cáo phòng và lớp, nhập Excel. Ở PR #9. Chi tiết: `docs/KE_HOACH.md` mục 3. **Không làm lại.**

## Danh sách việc (làm theo thứ tự)

Mô tả từ `docs/KE_HOACH.md` mục 2. Mỗi việc một commit.

- [x] B1. Sửa giờ tính lương từng buổi bằng tay, bắt buộc ghi lý do, ghi nhật ký thay đổi
- [x] B2. Trợ giảng gắn theo từng buổi (hiện chỉ gắn cả lớp), có thời lượng có mặt riêng, dùng khi tính lương
- [x] B3. Lương tự đưa vào chi phí của trung tâm nơi buổi dạy diễn ra (lãi lỗ hiện chia theo bảng lương)
- [x] B4. Đổi cách tính trùng giờ có ngày hiệu lực; tháng lương đã chốt giữ nguyên cách cũ
- [x] B5. Cấp độ dạy được của giáo viên, dùng khi gợi ý người dạy thay
- [x] B6. Cảnh báo khi ghi danh học sinh còn nợ khóa trước; cảnh báo giáo viên dạy 2 trung tâm sát giờ
- [ ] B7. Báo cáo doanh thu theo ngày và theo trung tâm học (hiện theo trung tâm thu); xuất .xlsx thật thay CSV
- [ ] B8. Hoàn tất đợt B: `npm run build` xanh, cập nhật `README.md` và bảng mục 2 của `docs/KE_HOACH.md`

Đợt C chưa làm: C1 cần Tuấn chốt nơi lưu file khi đưa lên mạng, C2 cần Tuấn trả lời câu hỏi ở mục 7 tài liệu yêu cầu.

## Bàn giao

Công cụ nào dừng giữa chừng thì ghi vào đây: việc đang làm, đã xong phần nào, còn lại gì, lỗi đang gặp, file đang sửa. Công cụ sau làm tiếp xong thì xóa mục này.

**B1 đã xong về code, cần Tuấn chạy SQL:** chạy file `docs/sql/2026-10-13-B1-gio-luong-sua-tay.sql` lên `prisma/dev.db` rồi `npx prisma generate`. Chưa chạy thì `dev.db` thật thiếu cột `payrollMinutes/payrollNote` nên test B1 và màn lương sẽ lỗi. Đã kiểm tra trên bản sao dev.db.

B2 cũng cần SQL: `docs/sql/2026-10-13-B2-tro-giang-theo-buoi.sql` (thêm bảng `SessionAssistant`), chạy sau file B1.

B3 không cần SQL.

B4 cũng cần SQL: `docs/sql/2026-10-13-B4-cach-tinh-trung-gio-theo-ngay.sql` (thêm bảng `TeacherOverlapPolicy`), chạy sau B2.

B5 cũng cần SQL: `docs/sql/2026-10-13-B5-cap-do-day-duoc.sql` (thêm cột `Teacher.teachableLevels`), chạy sau B4.

B6 không cần SQL.

Tiếp theo: B7.

## Nhật ký

| Ngày | Việc | Công cụ | Ghi chú |
|---|---|---|---|
| 13/10/2026 | B1 | Antigravity | Sửa giờ lương từng buổi kèm lý do: `src/server/payroll.ts`, route `api/sessions/[id]/payroll-hours`, `SessionDetailModal.tsx`, `tests/api-payroll-hours.test.ts`, SQL `docs/sql/2026-10-13-B1-gio-luong-sua-tay.sql`. Lint/typecheck/test xanh (167/167) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B2 | Antigravity | Trợ giảng theo từng buổi, có số phút riêng dùng khi tính lương (buổi có trợ giảng riêng thì bỏ trợ giảng cả lớp): bảng `SessionAssistant`, `src/server/payroll.ts`, route `api/sessions/[id]/assistants`, `tests/api-assistants.test.ts`, SQL `docs/sql/2026-10-13-B2-tro-giang-theo-buoi.sql`. Lint/typecheck/test xanh (171/171) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B3 | Antigravity | Lương tự tính vào chi phí trung tâm nơi buổi dạy diễn ra (tiền dạy chia theo tiền từng buổi ở từng trung tâm, thưởng/phạt vào trung tâm của bảng lương), tổng luôn khớp thực nhận: `payrollCostByCenter` trong `src/server/payroll.ts`, dùng ở `getProfitLossReport`, `tests/payroll-by-center.test.ts`. Không đổi schema. Lint/typecheck/test xanh (173/173). |
| 13/10/2026 | B4 | Antigravity | Cách tính trùng giờ có ngày hiệu lực: bảng `TeacherOverlapPolicy`, buổi dạy tính theo cách có hiệu lực tại ngày của buổi, không cho đặt ngày hiệu lực vào tháng đã chốt/đã trả (nên tháng đã chốt giữ cách cũ). `src/server/payroll.ts`, `src/lib/payroll.ts`, route `api/payroll/overlap`, `OverlapModal.tsx` (nút ở trang đơn giá), `tests/api-overlap-policy.test.ts`, SQL `docs/sql/2026-10-13-B4-cach-tinh-trung-gio-theo-ngay.sql`. Lint/typecheck/test xanh (177/177) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B5 | Antigravity | Cấp độ dạy được của giáo viên (`Teacher.teachableLevels`, nhập ở form giáo viên, hiện ở trang chi tiết), gợi ý dạy thay: đúng cấp độ +3 điểm, khác cấp độ -3, chưa khai thì không đổi; thẻ `Đúng cấp độ` / `Khác cấp độ dạy được`. `src/lib/levels.ts`, `src/server/staffing.ts`, `SubstituteModal.tsx`, `tests/levels.test.ts`, `tests/api-levels.test.ts`, SQL `docs/sql/2026-10-13-B5-cap-do-day-duoc.sql`. Lint/typecheck/test xanh (183/183) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B6 | Antigravity | Cảnh báo (không chặn): xếp lớp cho học sinh còn nợ khóa trước (`priorDebtsForStudent` trong `src/server/finance.ts`, API ghi danh trả thêm `warnings`, màn xếp lớp hiện cảnh báo); mở lớp mà giáo viên dạy 2 trung tâm cách dưới 60 phút (`findTightGaps` trong `src/lib/schedule.ts`, nối vào `planClass`). `tests/warnings-b6.test.ts`. Không đổi schema. Lint/typecheck/test xanh (188/188). |
