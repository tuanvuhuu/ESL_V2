# Tiến độ và bàn giao

Claude Code (NOVA) và Antigravity làm chung file này. Luật chung: `docs/RULES.md` (đọc trước). Quy trình: `CLAUDE.md`. Mọi commit vào nhánh `common`.

Trạng thái: `[ ]` chưa làm · `[~]` đang làm dở · `[x]` xong (lint, typecheck, test xanh, đã commit và push lên `common`)

## Đã xong trước khi chuyển sang NOVA / Antigravity

- [x] Đợt A (A1–A9): khung chương trình, tài liệu, buổi kiểm tra, điểm kỹ năng, mua thêm buổi, khóa tiếp theo, báo cáo học sinh, báo cáo phòng và lớp, nhập Excel. Ở PR #9. Chi tiết: `docs/KE_HOACH.md` mục 3. **Không làm lại.**

## Danh sách việc (làm theo thứ tự)

Mô tả từ `docs/KE_HOACH.md` mục 2. Mỗi việc một commit.

- [x] B1. Sửa giờ tính lương từng buổi bằng tay, bắt buộc ghi lý do, ghi nhật ký thay đổi
- [~] B2. Trợ giảng gắn theo từng buổi (hiện chỉ gắn cả lớp), có thời lượng có mặt riêng, dùng khi tính lương. **Mở lại 13/10:** mới có API và phần tính lương, chưa có màn hình nào gọi `api/sessions/[id]/assistants`, trợ giảng theo buổi chưa thấy buổi trong lịch và chưa vào được trang điểm danh. Phần còn lại làm ở D1.
- [x] B3. Lương tự đưa vào chi phí của trung tâm nơi buổi dạy diễn ra (lãi lỗ hiện chia theo bảng lương)
- [x] B4. Đổi cách tính trùng giờ có ngày hiệu lực; tháng lương đã chốt giữ nguyên cách cũ
- [x] B5. Cấp độ dạy được của giáo viên, dùng khi gợi ý người dạy thay
- [x] B6. Cảnh báo khi ghi danh học sinh còn nợ khóa trước; cảnh báo giáo viên dạy 2 trung tâm sát giờ
- [x] B7. Báo cáo doanh thu theo ngày và theo trung tâm học (hiện theo trung tâm thu); xuất .xlsx thật thay CSV
- [x] B8. Hoàn tất đợt B: `npm run build` xanh, cập nhật `README.md` và bảng mục 2 của `docs/KE_HOACH.md`

Đợt C chưa làm: C1 cần Tuấn chốt nơi lưu file khi đưa lên mạng, C2 cần Tuấn trả lời câu hỏi ở mục 7 tài liệu yêu cầu.

## Đợt D (lập 13/10/2026, đối chiếu `Tổng quan yêu cầu.md` mục 3 và rà soát giao diện)

Làm theo thứ tự nhóm. Mỗi việc một commit `done(Dx)`.

### Ưu tiên 1: còn thiếu so với yêu cầu, dùng hằng ngày

- [ ] D1. Trợ giảng theo từng buổi, phần còn lại của B2: trong chi tiết buổi (lịch học, trang buổi) thêm / bỏ trợ giảng và số phút có mặt; trợ giảng theo buổi thấy buổi đó trong lịch của mình và vào được trang buổi (`src/server/access.ts`, `src/server/attendance.ts` hiện chỉ xét trợ giảng cả lớp). Mục 3.5.
- [ ] D2. Hộp hoàn tiền hiện số buổi chưa học của ghi danh để quản lý tham khảo (`StudentFinanceTab.tsx` hiện chỉ có số tiền tối đa). Mục 3.7.
- [ ] D3. Báo cáo lọc theo khoảng thời gian (từ ngày, đến ngày) thay vì một tháng: doanh thu, lãi lỗ, giáo viên, học sinh, sử dụng phòng; chuyên cần chọn được khoảng ngày trên giao diện (API đã nhận `fromDate`, `toDate`). Mục 3.8.
- [ ] D4. Báo cáo chuyên cần theo từng học sinh (hiện chỉ theo lớp), xuất Excel. Mục 3.8.
- [ ] D5. Xuất Excel (.xlsx) ở trang Công nợ (danh sách nợ, nợ quá hạn) và đổi nút xuất danh sách Học sinh từ CSV sang .xlsx (`src/app/students/page.tsx` còn dùng `downloadCsv`). Mục 3.8.

### Ưu tiên 2: bổ sung cho đủ yêu cầu

- [ ] D6. Lịch dạy cá nhân xem theo tháng (lịch học hiện có ngày và tuần). Mục 3.3.
- [ ] D7. Lịch sử thay đổi của phiếu thu và phiếu hoàn tiền cho quản lý (đã ghi nhật ký nhưng chưa có chỗ xem; `AuditTimeline` chỉ có ở học sinh, phụ huynh, lớp, giáo viên). Mục 3.9.
- [ ] D8. Danh mục dùng chung sửa được ở Cài đặt: lý do nghỉ học, loại giảm giá, loại chi phí, phương thức thanh toán (hiện viết cứng trong code). Có đổi schema thì viết SQL vào `docs/sql/`. Mục 3.1.
- [ ] D9. Sửa giao diện nhỏ theo rà soát: tab "More" tiếng Anh ở trang Hôm nay, bảng Học sinh tràn màn hình 1440px làm cắt cột cuối. `ra-soat-ui.md` mục Chưa sửa, ý 5.

### Ưu tiên 3: giao diện một nguồn, đổi nhiều file (hỏi Tuấn trước khi làm)

- [ ] D10. Ngăn trượt phải tự làm (`PrimerModal`) đổi sang `Dialog position="right"` của Primer để có bẫy tiêu điểm bàn phím. Rà soát ý 1.
- [ ] D11. Gom cỡ chữ inline (12 cỡ, 11 đến 48px) về thang của Primer (12, 14, 16, 20, 32px). Rà soát ý 3.
- [ ] D12. Thay các thành phần tự làm trong bộ kit bằng thành phần Primer có sẵn (`Card`, `Row/Col`, `Space` sang `Stack`; `Popover`, `Collapse`, `Steps`…), giảm dần inline style. Rà soát ý 1, 2, 4.

### Chờ Tuấn trả lời (mục 7 tài liệu yêu cầu)

- [ ] D13. Lương cho giờ ngoài lớp (chấm bài, họp, học thử, coi kiểm tra đầu vào), buổi hủy sát giờ khi giáo viên đã đến, đi muộn về sớm có trừ giờ không. Làm sau khi có câu trả lời.

## Bàn giao

Kiểm tra lại ngày 13/10/2026 (thread cloud): trên `common` lint (0 lỗi), typecheck, test 194/194, build đều xanh; 4 file SQL trong `docs/sql/` áp lên schema cũ thì khớp đúng `schema.prisma`. A1–A9 và B1, B3–B8 có code và test đúng như ghi. **B2 mở lại thành `[~]`:** chưa có màn hình gắn trợ giảng theo buổi và trợ giảng theo buổi chưa có quyền xem / điểm danh buổi đó; việc còn lại chuyển thành D1. Đợt D đã lập, chưa bắt đầu.

Đợt B (B1, B3–B8) đã xong. 4 file SQL của B1, B2, B4, B5 đã được chạy lên `prisma/dev.db` ngày 13/10/2026 (Tuấn đồng ý, có bản sao lưu `prisma/dev.db.bak-*`) và đã `npx prisma generate`. Lint, typecheck, test (194/194) xanh trên `dev.db` thật. Đợt C chờ Tuấn (C1 nơi lưu file, C2 câu hỏi mục 7).

## Nhật ký

| Ngày | Việc | Công cụ | Ghi chú |
|---|---|---|---|
| 13/10/2026 | B1 | Antigravity | Sửa giờ lương từng buổi kèm lý do: `src/server/payroll.ts`, route `api/sessions/[id]/payroll-hours`, `SessionDetailModal.tsx`, `tests/api-payroll-hours.test.ts`, SQL `docs/sql/2026-10-13-B1-gio-luong-sua-tay.sql`. Lint/typecheck/test xanh (167/167) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B2 | Antigravity | Trợ giảng theo từng buổi, có số phút riêng dùng khi tính lương (buổi có trợ giảng riêng thì bỏ trợ giảng cả lớp): bảng `SessionAssistant`, `src/server/payroll.ts`, route `api/sessions/[id]/assistants`, `tests/api-assistants.test.ts`, SQL `docs/sql/2026-10-13-B2-tro-giang-theo-buoi.sql`. Lint/typecheck/test xanh (171/171) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B3 | Antigravity | Lương tự tính vào chi phí trung tâm nơi buổi dạy diễn ra (tiền dạy chia theo tiền từng buổi ở từng trung tâm, thưởng/phạt vào trung tâm của bảng lương), tổng luôn khớp thực nhận: `payrollCostByCenter` trong `src/server/payroll.ts`, dùng ở `getProfitLossReport`, `tests/payroll-by-center.test.ts`. Không đổi schema. Lint/typecheck/test xanh (173/173). |
| 13/10/2026 | B4 | Antigravity | Cách tính trùng giờ có ngày hiệu lực: bảng `TeacherOverlapPolicy`, buổi dạy tính theo cách có hiệu lực tại ngày của buổi, không cho đặt ngày hiệu lực vào tháng đã chốt/đã trả (nên tháng đã chốt giữ cách cũ). `src/server/payroll.ts`, `src/lib/payroll.ts`, route `api/payroll/overlap`, `OverlapModal.tsx` (nút ở trang đơn giá), `tests/api-overlap-policy.test.ts`, SQL `docs/sql/2026-10-13-B4-cach-tinh-trung-gio-theo-ngay.sql`. Lint/typecheck/test xanh (177/177) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B5 | Antigravity | Cấp độ dạy được của giáo viên (`Teacher.teachableLevels`, nhập ở form giáo viên, hiện ở trang chi tiết), gợi ý dạy thay: đúng cấp độ +3 điểm, khác cấp độ -3, chưa khai thì không đổi; thẻ `Đúng cấp độ` / `Khác cấp độ dạy được`. `src/lib/levels.ts`, `src/server/staffing.ts`, `SubstituteModal.tsx`, `tests/levels.test.ts`, `tests/api-levels.test.ts`, SQL `docs/sql/2026-10-13-B5-cap-do-day-duoc.sql`. Lint/typecheck/test xanh (183/183) trên bản sao dev.db đã áp SQL. |
| 13/10/2026 | B6 | Antigravity | Cảnh báo (không chặn): xếp lớp cho học sinh còn nợ khóa trước (`priorDebtsForStudent` trong `src/server/finance.ts`, API ghi danh trả thêm `warnings`, màn xếp lớp hiện cảnh báo); mở lớp mà giáo viên dạy 2 trung tâm cách dưới 60 phút (`findTightGaps` trong `src/lib/schedule.ts`, nối vào `planClass`). `tests/warnings-b6.test.ts`. Không đổi schema. Lint/typecheck/test xanh (188/188). |
| 13/10/2026 | B7 | Antigravity | Báo cáo doanh thu thêm bảng theo ngày và theo trung tâm học (trung tâm của lớp đang học, khác trung tâm thu): `getRevenueReport` trong `src/server/reports.ts`, `src/app/reports/page.tsx`. Xuất .xlsx thật (3 sheet cho doanh thu) thay CSV ở mọi báo cáo: `src/lib/xlsx.ts`, `src/client/xlsx.ts`. Không thêm thư viện mới: tự ghi file xlsx (ZIP không nén), đã kiểm tra đọc lại được bằng `read-excel-file` sẵn có. `tests/xlsx.test.ts`, `tests/api-revenue-b7.test.ts`. Không đổi schema. Lint/typecheck/test xanh (194/194). |
| 13/10/2026 | B8 | Antigravity | `npm run build` xanh; cập nhật `README.md` và bảng mục 2, mục 4 của `docs/KE_HOACH.md`; ghi Bàn giao các file SQL cho Tuấn. |
| 13/10/2026 | Sửa lỗi thiếu cột | Antigravity | `dev.db` thật thiếu cột / bảng của B1, B2, B4, B5 nên test và màn hình lỗi. Đã chạy 4 file SQL trong `docs/sql/` lên `prisma/dev.db` (được Tuấn cho phép, có sao lưu), generate lại, 194/194 test xanh. |
| 13/10/2026 | Kiểm tra A1–A9, B1–B8; lập đợt D | Claude (cloud) | Lint, typecheck, test 194/194, build xanh trên `common`. SQL B1, B2, B4, B5 khớp schema. Mở lại B2 (thiếu màn hình và quyền cho trợ giảng theo buổi). Thêm D1–D13. |
