# Trạng thái tính năng và kế hoạch triển khai

Cập nhật: 13/10/2026. Đối chiếu code trên nhánh `main` (commit 23d39a3) với tài liệu **Tổng quan yêu cầu** (mục 3–6).

Ký hiệu: ✅ đã có · 🟡 có một phần · ❌ chưa có.

**Cập nhật cuối ngày 13/10/2026:** đợt A (A1–A9) đã làm xong trong nhánh `claude/project-thread-80d4qj` (PR đặt lên trên PR #7 giao diện một nguồn). Còn lại đợt B và C ở mục 4.

## 1. Đã triển khai

| Phân hệ (mục yêu cầu) | Đã có | Ở đâu |
|---|---|---|
| 3.1 Danh mục nền | ✅ Trung tâm (màu, địa chỉ, giờ hoạt động), phòng (sức chứa, thiết bị, tạm khóa), khóa học, ngày nghỉ lễ chung / từng trung tâm | Cài đặt |
| 3.2 Học sinh, phụ huynh | ✅ Hồ sơ, trạng thái kèm lý do, tối đa 2 người giám hộ, người liên hệ chính / người đóng tiền, anh chị em qua phụ huynh chung, nhật ký liên lạc + việc cần gọi lại, trang tổng hợp học sinh, tìm không dấu theo tên / SĐT phụ huynh, cảnh báo trùng hồ sơ | Học sinh, Phụ huynh, Cần gọi lại |
| 3.3 Giáo viên, trợ giảng | ✅ Hồ sơ (loại, VN / nước ngoài, toàn / bán thời gian, bằng cấp, hạn chứng chỉ), trung tâm dạy, lịch rảnh tuần, đăng ký nghỉ, đơn giá giờ theo vai trò có ngày hiệu lực, cách tính trùng giờ theo người, lịch tuần gộp 4 trung tâm, giờ dạy theo tháng | Giáo viên, Lương › Đơn giá giờ |
| 3.4 Khóa học, bài giảng | ✅ Khung chương trình theo buổi, link tài liệu, buổi kiểm tra; buổi học tự gắn bài; khóa tiếp theo gợi ý (đợt A) | Cài đặt › Khóa học, trang điểm danh |
| 3.5 Lớp và lịch | ✅ Mở lớp từng bước, sinh buổi bỏ ngày lễ, chặn trùng phòng / người dạy khác trung tâm / học sinh trùng giờ / quá sĩ số, dời, đổi phòng, dạy thay (gợi ý người phù hợp), hủy + nối buổi cuối lịch, chuyển lớp, chuyển trung tâm, học bù / học ké, lịch ngày theo phòng và lịch tuần, trạng thái lớp tự đổi, thao tác hàng loạt | Lịch học, Lớp học, Học bù |
| 3.6 Điểm danh, học tập | ✅ Điểm danh 4 trạng thái, mặc định có mặt, sửa lại có lịch sử, nhận xét ngắn có câu mẫu, nội dung đã dạy, điểm kiểm tra theo kỹ năng (đợt A), số buổi còn lại, bảo lưu, danh sách cần chú ý, kết quả và nhận xét cuối khóa, sổ học tập in được | Hôm nay, Buổi học, Hồ sơ học sinh › Lịch sử học tập |
| 3.7 Tài chính | ✅ Học phí gói buổi + giảm giá (5 loại, % hoặc số tiền), phiếu thu in được, nhiều đợt, công nợ + quá hạn, hoàn tiền (quản lý), hủy phiếu kèm lý do, chi phí theo trung tâm và loại, bảng lương tháng (chi tiết buổi, đánh dấu trùng giờ, 3 cách tính, thưởng / phạt / phụ cấp), chốt lương, ghi nhận đã trả, giáo viên xem lương của mình, mua thêm buổi (đợt A) | Tài chính, Lương, Lương của tôi |
| 3.8 Báo cáo | ✅ Tổng quan hôm nay, doanh thu (theo trung tâm, phương thức), lãi lỗ theo trung tâm, giáo viên (giờ, buổi dạy thay, lương), chuyên cần theo lớp, học sinh và sử dụng phòng & lớp (đợt A); xuất CSV mở bằng Excel | Báo cáo & Thống kê |
| 6 Chuyển dữ liệu | ✅ Nhập học sinh, phụ huynh, số buổi còn lại, công nợ từ .xlsx / .csv (đợt A) | Học sinh › Nhập từ Excel |
| 3.9 Phân quyền, nhật ký | ✅ 4 vai trò, chặn ở cả API và giao diện, nhật ký thay đổi tự động | `src/lib/permissions.ts`, `src/server/audit.ts` |
| Giao diện | ✅ GitHub Primer React, danh sách dạng data grid, ngăn kéo xem nhanh bên phải, màn hình giáo viên trên điện thoại | `src/components/PrimerGrid.tsx`, `src/client/primer-compat.tsx` |

## 2. Còn thiếu so với yêu cầu đợt 1

| # | Hạng mục | Mục | Tình trạng | Đợt |
|---|---|---|---|---|
| A1 | Khung chương trình theo buổi: buổi số, chủ đề, mục tiêu, nội dung, bài tập về nhà | 3.4 | ✅ | A |
| A2 | Tài liệu theo buổi (link giáo án, slide, audio) | 3.4 | ✅ | A (dạng link) |
| A3 | Đánh dấu buổi kiểm tra (giữa khóa, cuối khóa); buổi học tự gắn bài tương ứng để giáo viên biết hôm nay dạy gì | 3.4 | ✅ | A |
| A4 | Điểm kiểm tra theo kỹ năng Nghe, Nói, Đọc, Viết, tổng; hiện trong lịch sử học tập và sổ học tập | 3.6 | ✅ | A |
| A5 | Mua thêm buổi (gia hạn) cho ghi danh đang học | 3.7 | ✅ | A |
| A6 | Khóa tiếp theo gợi ý của mỗi khóa | 3.1, 4.5 | ✅ | A |
| A7 | Báo cáo học sinh: đang học, ghi danh mới, bảo lưu, nghỉ theo lý do, tỷ lệ học tiếp | 3.8 | ✅ | A |
| A8 | Báo cáo sử dụng phòng và lớp: tỷ lệ lấp đầy lớp, tỷ lệ dùng phòng theo khung giờ | 3.8 | ✅ | A |
| A9 | Nhập học sinh, phụ huynh, số buổi còn lại, công nợ từ Excel (M15) | 6 | ✅ | A |
| B1 | Sửa giờ tính lương từng buổi bằng tay kèm lý do | 3.7 | ✅ | B |
| B2 | Trợ giảng gắn theo từng buổi, có thời lượng có mặt riêng | 3.5, 3.7 | 🟡 có API và tính lương, thiếu màn hình và quyền (D1) | B |
| B3 | Lương tự đưa vào chi phí của trung tâm nơi buổi dạy diễn ra | 3.7 | ✅ | B |
| B4 | Đổi cách tính trùng giờ có ngày hiệu lực (tháng đã chốt giữ nguyên) | 3.7, 5 | ✅ | B |
| B5 | Cấp độ dạy được của giáo viên, dùng khi gợi ý dạy thay | 3.3 | ✅ | B |
| B6 | Cảnh báo ghi danh khi còn nợ khóa trước; cảnh báo dạy 2 trung tâm sát giờ | 5 | ✅ | B |
| B7 | Báo cáo doanh thu theo ngày và theo trung tâm học; xuất .xlsx thật thay CSV | 3.8 | ✅ | B |
| C1 | Ảnh học sinh, file đính kèm tài liệu (cần chỗ lưu file khi đưa lên mạng) | 3.2, 3.4 | ❌ | C |
| C2 | Quản lý được bỏ qua lệnh chặn trong trường hợp đặc biệt | 7 | chờ trả lời | C |
| D1–D13 | Đợt D: phần còn lại của B2, hoàn tiền hiện buổi chưa học, báo cáo theo khoảng ngày, chuyên cần theo học sinh, xuất Excel công nợ, lịch tháng, lịch sử phiếu thu, danh mục sửa được, sửa giao diện theo rà soát. Chi tiết ở `docs/TIEN_DO.md` | 3.1–3.9 | ❌ | D |
| — | Giai đoạn 2: cổng phụ huynh, Zalo / SMS, tuyển sinh, bài tập online | 6 | ngoài phạm vi | — |

## 3. Đợt A: chi tiết đã làm

### A1–A3. Khung chương trình, tài liệu, buổi kiểm tra

- **Dữ liệu:** bảng mới `CourseLesson` (khóa, buổi số, chủ đề, mục tiêu, nội dung, bài tập về nhà, tài liệu dạng danh sách link `{tên, link}`, loại kiểm tra: không / giữa khóa / cuối khóa / kiểm tra nhỏ). Khóa + buổi số là duy nhất.
- **Gắn với buổi học:** không lưu khóa ngoại; buổi số N của lớp tự lấy bài số N của khóa. Đổi khung chương trình là các lớp đang học thấy ngay, buổi hủy rồi nối cuối lịch vẫn đúng bài vì buổi được đánh lại số.
- **Màn hình:** Cài đặt › Khóa học có nút **Khung chương trình** mở bảng sửa từng buổi (thêm, sửa, xóa bài; nút "Tạo đủ N buổi trống"). Trang điểm danh và thẻ buổi của giáo viên hiện "Bài hôm nay: chủ đề", bấm xem mục tiêu, nội dung, bài tập, link tài liệu. Buổi kiểm tra có nhãn.
- **Quyền:** quản lý sửa; mọi người đăng nhập xem được.

### A4. Điểm kiểm tra theo kỹ năng

- **Dữ liệu:** bảng mới `TestScore` (buổi, học sinh, ghi danh, Nghe, Nói, Đọc, Viết, tổng, ghi chú, người nhập). Mỗi học sinh một dòng mỗi buổi. Điểm thang 10, cho phép số lẻ; tổng tự tính trung bình các kỹ năng đã nhập nếu không nhập tay.
- **Màn hình:** trang điểm danh của buổi kiểm tra (theo khung chương trình) có thêm bảng **Nhập điểm**; buổi thường có nút "Nhập điểm cho buổi này" để vẫn nhập được khi chưa có khung. Lịch sử học tập theo khóa và sổ học tập in có bảng điểm.
- **Quyền:** như điểm danh (người dạy, trợ giảng của buổi, giáo vụ trung tâm, quản lý). Ghi nhật ký thay đổi.

### A5. Gia hạn (mua thêm buổi)

- Trên tab Học phí của hồ sơ học sinh, mỗi ghi danh đang học có nút **Mua thêm buổi**: số buổi, đơn giá / thành tiền (gợi ý theo đơn giá gói hiện tại), hạn đóng, ghi chú. Hệ thống cộng số buổi đã mua và học phí; phần chưa đóng thành công nợ. Ghi nhật ký.

### A6. Khóa tiếp theo gợi ý

- `Course.nextCourseId`. Sửa ở Cài đặt › Khóa học. Hiện trên lịch sử học tập của khóa đã xong: "Khóa tiếp theo gợi ý: …", dùng cho tỷ lệ học tiếp.

### A7. Báo cáo học sinh

- Lọc trung tâm + khoảng tháng. Số liệu: đang học, chờ xếp lớp, bảo lưu, đã nghỉ; ghi danh mới trong kỳ; bảo lưu mới; nghỉ theo lý do; tỷ lệ học tiếp = học sinh có ghi danh mới sau khi kết thúc một khóa / học sinh kết thúc khóa trong kỳ. Xuất CSV.

### A8. Báo cáo sử dụng phòng và lớp

- Lớp đang học: sĩ số / tối đa, tỷ lệ lấp đầy, sắp xếp lớp vắng chỗ lên đầu.
- Phòng: số giờ có buổi học trong kỳ / số giờ mở cửa (mặc định 8:00–21:00 mỗi ngày trừ ngày lễ), và lưới phòng × khung giờ (sáng / chiều / tối) cho thấy khung nào trống. Xuất CSV.

### A9. Nhập dữ liệu từ Excel

- Trang **Cài đặt › Nhập dữ liệu** (quản lý). Tải file mẫu, chọn file `.xlsx` hoặc `.csv`.
- Cột: Họ tên*, Ngày sinh*, Giới tính, Mã trung tâm*, Trường, Lớp ở trường, Trình độ, Tên phụ huynh*, SĐT phụ huynh*, Quan hệ, Mã lớp, Số buổi còn lại, Còn nợ, Hạn đóng, Ghi chú.
- Bước 1 **Kiểm tra**: hệ thống đọc từng dòng, báo lỗi theo dòng (thiếu cột bắt buộc, sai ngày, trung tâm / lớp không có, trùng học sinh đã có), không ghi gì.
- Bước 2 **Nhập**: chỉ nhập các dòng hợp lệ, trong một giao dịch. Phụ huynh trùng SĐT dùng lại hồ sơ cũ. Có mã lớp thì ghi danh từ hôm nay với số buổi đã mua = số buổi còn lại; có "còn nợ" thì học phí ghi danh = số nợ để hiện trong Công nợ. Ghi nhật ký.

### Kiểm thử và hoàn tất

- 35 test mới (163 test tổng): logic thuần (điểm, gia hạn, báo cáo, đọc CSV / ngày / số tiền) và API (quyền từng vai trò, khung chương trình, điểm, mua thêm buổi, báo cáo, nhập Excel).
- `npm run lint && npm run typecheck && npm test && npm run build` xanh; chạy thử trên trình duyệt với file .xlsx thật.
- Sửa kèm: trang điểm danh bị lỗi trắng vì Tooltip của Primer đòi phần tử kích hoạt phải tương tác được (ô "Còn lại").
- `run.bat` giờ luôn chạy `npm install` và `prisma db push` để máy đang chạy có bảng mới.
- Dữ liệu mẫu có sẵn khung chương trình cho 5 khóa, khóa tiếp theo, điểm các buổi kiểm tra nhỏ đã qua.

### Ghi chú thiết kế

- Tài liệu chỉ lưu dạng link (Google Drive, YouTube…). Tải file lên cần chỗ lưu file khi đưa lên mạng, để đợt C.
- Điểm gắn với buổi học và ghi danh; buổi học bù vẫn nhập được điểm vì học sinh học bù có trong danh sách của buổi đó.
- Nhập Excel: một dòng lỗi lúc ghi (ví dụ lớp vừa đủ chỗ) thì hủy cả lần nhập để không nhập dở dang; dòng lỗi phát hiện ở bước kiểm tra thì chỉ bỏ dòng đó.

## 4. Đợt B và C

**Trạng thái (13/10/2026): đợt B đã làm xong (B1–B7), mỗi mục một commit trên nhánh `common`.** Còn việc cho Tuấn: chạy các file SQL trong `docs/sql/` (B1, B2, B4, B5) lên `prisma/dev.db` rồi `npx prisma generate`. Xem `docs/TIEN_DO.md` mục Bàn giao và Nhật ký.

| Mục | Trạng thái |
|---|---|
| A1–A9 | ✅ Xong (PR #9) |
| B1–B7 | ✅ Xong, lint / typecheck / test xanh (kiểm tra trên bản sao dev.db đã áp SQL) |
| C1–C2 | ○ Chưa bắt đầu, chờ chốt (nơi lưu file; câu hỏi mục 7 tài liệu yêu cầu) |


Đợt B đã xong. C1 cần chốt nơi lưu file khi đưa lên mạng; C2 cần trả lời câu hỏi ở mục 7 tài liệu yêu cầu.
