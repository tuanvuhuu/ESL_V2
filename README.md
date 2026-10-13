# Quản lý trung tâm tiếng Anh (ESL v2)

Hệ thống gọn nhẹ để một quản lý điều hành 4 trung tâm tiếng Anh: học sinh, phụ huynh, giáo viên/trợ giảng, khung chương trình, lớp và lịch học, điểm danh và lịch sử học tập, học phí, lương, chi phí, báo cáo.

Trạng thái từng tính năng so với tài liệu yêu cầu và kế hoạch các đợt tiếp theo: [docs/KE_HOACH.md](docs/KE_HOACH.md).

**Stack:** Next.js 15 (App Router) · React 19 · GitHub Primer (React + Primitives) · Prisma 6 · SQLite (chạy máy) → PostgreSQL khi đưa lên mạng · TypeScript · Vitest.

## Chạy trên máy

Cần Node.js 22.

```bash
cp .env.example .env
npm install          # tự chạy prisma generate
npm run db:push      # tạo database SQLite ở prisma/dev.db
npm run db:seed      # dữ liệu mẫu: 4 trung tâm, 36 học sinh, 8 giáo viên, 7 lớp, 7 tài khoản
npm run dev          # http://localhost:3000
```

Tài khoản chạy thử (mật khẩu `matkhau123`, chỉ có trong dữ liệu mẫu): `quanly` (quản lý), `giaovu.a` … `giaovu.d` (giáo vụ từng trung tâm), `lan` (giáo viên Ms Lan), `thu` (trợ giảng Thư).

Database mới, chưa có tài khoản nào: mở trang đăng nhập sẽ hiện ô tạo tài khoản quản lý đầu tiên. Sau đó quản lý tạo tài khoản cho giáo vụ, giáo viên ở **Cài đặt › Tài khoản**.

Xóa sạch và tạo lại dữ liệu mẫu: `npm run db:reset`.

Sau khi lấy code mới về: chạy `npm install` rồi `npm run db:push` để database có thêm bảng / cột mới (không mất dữ liệu). `run.bat` tự làm hai bước này.

Kiểm tra trước khi đẩy code: `npm run lint && npm run typecheck && npm test && npm run build`. Test phân quyền API chạy trên dữ liệu mẫu, nên cần `db:push` và `db:seed` trước.

## Đã có trong đợt 1

| Màn hình | Nội dung |
|---|---|
| Hôm nay | Buổi học hôm nay theo từng trung tâm, số buổi chưa điểm danh, hủy, dạy thay; danh sách cần chú ý: sắp hết buổi (≤ 3), hết buổi vẫn đi học, vắng nhiều, buổi chưa điểm danh, vắng chưa bù |
| Điểm danh | Mở từ thẻ buổi: mặc định có mặt, chạm đổi Có mặt → Muộn → Vắng có phép → Vắng không phép; nhận xét ngắn (có câu mẫu), một dòng nội dung đã dạy; sửa lại được, mỗi thay đổi vào lịch sử |
| Số buổi còn lại | Ghi danh có số buổi đã mua và điều chỉnh tay (kèm lý do). Còn lại = đã mua − có mặt/muộn − vắng không phép ± điều chỉnh |
| Học bù | Danh sách buổi vắng chưa bù; gợi ý buổi cùng khóa, cùng buổi số, còn chỗ, không trùng giờ, ưu tiên trung tâm chính; học sinh hiện trong danh sách điểm danh buổi đó với nhãn tím |
| Giáo viên (điện thoại) | Hôm nay (thẻ buổi + nút Điểm danh, buổi tuần qua còn quên), Lịch tuần này / tuần sau, Lớp của tôi (chuyên cần, buổi còn lại từng em), Tài khoản (giờ dạy theo tháng, đổi mật khẩu) |
| Cấp độ dạy được | Form giáo viên có ô cấp độ dạy được (ví dụ "Starters, Movers"); gợi ý dạy thay cộng điểm khi đúng cấp độ của khóa, trừ điểm khi khác, chưa khai thì không đổi |
| Lịch rảnh | Hồ sơ giáo viên › Lịch rảnh và Tài khoản của giáo viên: lưới tuần 07:00–22:00, sửa dạng danh sách khung giờ (gắn trung tâm hoặc mọi trung tâm) |
| Đăng ký nghỉ | Chọn khoảng ngày + lý do, không cần duyệt; hiện ngay các buổi bị ảnh hưởng, mỗi buổi có nút Tìm người dạy thay. Hôm nay có mục "Cần người dạy thay" (14 ngày tới) |
| Dạy thay | Gợi ý người dạy thay sắp theo mức phù hợp, nhãn Rảnh / Ngoài lịch rảnh / Đang nghỉ / Đang dạy lớp khác / Chưa dạy khóa này; người bận ở trung tâm khác cùng giờ không chọn được |
| Chuyển lớp | Từ lớp hoặc hồ sơ học sinh: chọn lớp mới (cùng khóa hiện trước) và ngày chuyển; số buổi còn lại đi theo, có thể đổi luôn trung tâm chính |
| Bảo lưu | Đổi trạng thái › Bảo lưu: ngày bắt đầu, ngày dự kiến quay lại; trong thời gian bảo lưu không có trong danh sách điểm danh nên số buổi giữ nguyên; Hôm nay có mục "Bảo lưu đến hạn" |
| Học sinh | Danh sách theo mẫu chuẩn (tìm không dấu, lọc trạng thái có số lượng, ghim/ẩn cột, menu ⋯, xuất Excel), thêm/sửa trong popup, cảnh báo trùng hồ sơ, gợi ý phụ huynh theo SĐT, đổi trạng thái kèm lý do, hồ sơ có tab tổng quan / lịch sử lớp / lịch sử thay đổi |
| Phụ huynh | Danh sách, hồ sơ với thẻ từng con, tự nhận anh chị em qua phụ huynh chung, tối đa 2 người giám hộ / học sinh |
| Giáo viên | Giáo viên, trợ giảng hoặc cả hai; trung tâm dạy được; giờ dạy theo lịch trong tháng; lịch tuần gộp 4 trung tâm |
| Lớp học | Mở lớp từng bước, tự sinh buổi học bỏ ngày lễ, xem trước và chặn trùng; xếp học sinh, rời lớp; sửa trợ giảng; đổi trạng thái lớp |
| Lịch học | Lưới phòng × giờ theo ngày, lịch tuần, lọc theo trung tâm / giáo viên; bấm buổi để dời, đổi phòng, dạy thay, hủy (có thể nối buổi vào cuối lịch) |
| Khung chương trình | Cài đặt › Khóa học › Khung chương trình: từng buổi có chủ đề, mục tiêu, nội dung, bài tập về nhà, link tài liệu, đánh dấu buổi kiểm tra (nhỏ / giữa khóa / cuối khóa). Buổi số N của lớp tự lấy bài số N, hiện trên trang điểm danh và thẻ buổi của giáo viên |
| Điểm kiểm tra | Trang điểm danh của buổi kiểm tra có bảng nhập điểm Nghe, Nói, Đọc, Viết (thang 10), tổng tự tính trung bình nếu để trống; buổi thường có nút "Nhập điểm kiểm tra cho buổi này". Điểm hiện trong lịch sử học tập, sổ học tập in và tin nhắn gửi phụ huynh |
| Học phí & công nợ | Ghi danh có giá gói, giảm giá (anh chị em, học sinh cũ, đóng sớm, học bổng, khuyến mãi), hạn đóng; phiếu thu in được, thu nhiều đợt, hủy kèm lý do; hoàn tiền (quản lý); **mua thêm buổi** cho ghi danh đang học; danh sách công nợ, quá hạn |
| Chi phí, lương | Chi phí theo trung tâm và loại; đơn giá giờ theo người và vai trò, có ngày hiệu lực; bảng lương tháng chi tiết từng buổi, 3 cách tính khi đứng nhiều lớp trùng giờ, thưởng / phạt / phụ cấp, chốt lương, đã trả; giáo viên xem lương của mình. Quản lý sửa tay giờ tính lương từng buổi (bắt buộc lý do, có nhật ký); trợ giảng gắn theo từng buổi kèm số phút có mặt riêng; cách tính trùng giờ đổi theo ngày hiệu lực (tháng đã chốt giữ cách cũ); lương tính vào chi phí của trung tâm nơi buổi dạy diễn ra |
| Báo cáo | Tổng quan hôm nay, doanh thu (theo trung tâm thu, theo trung tâm học, theo ngày), lãi lỗ theo trung tâm, giáo viên & giờ dạy, chuyên cần, **học sinh** (trạng thái, ghi danh mới, bảo lưu, nghỉ theo lý do, tỷ lệ học tiếp), **sử dụng phòng & lớp** (lấp đầy lớp, dùng phòng theo sáng / chiều / tối); xuất file .xlsx |
| Liên lạc phụ huynh | Nhật ký liên lạc trong hồ sơ học sinh, việc cần gọi lại (menu Cần gọi lại) |
| Nhập từ Excel | Học sinh › Nhập từ Excel: tải file mẫu, chọn file .xlsx / .csv, hệ thống kiểm tra từng dòng (thiếu cột, sai ngày, trung tâm / lớp không có, trùng hồ sơ) rồi mới nhập. Có mã lớp thì xếp lớp từ hôm nay với số buổi còn lại; có "Còn nợ" thì hiện trong Công nợ |
| Cài đặt | Trung tâm & màu, phòng học, ngày nghỉ lễ (chung hoặc từng trung tâm), khóa học (kèm khóa tiếp theo gợi ý và khung chương trình), tài khoản |
| Đăng nhập | Tên đăng nhập + mật khẩu, nhớ 30 ngày; đổi mật khẩu, đăng xuất ở góc phải; sai 5 lần thì khóa 15 phút |

**Phân quyền** (mặc định theo đặc tả đợt 1, chặn ở cả API lẫn giao diện; mục không có quyền thì ẩn hẳn):

| | Quản lý | Giáo vụ | Giáo viên | Trợ giảng |
|---|---|---|---|---|
| Chọn "Tất cả trung tâm" | ✓ | – (mặc định trung tâm mình) | – | – |
| Học sinh, lớp, buổi học trung tâm mình | Sửa | Sửa | Xem lớp mình | Xem lớp mình |
| Học sinh, lớp trung tâm khác | Sửa | Xem | – | – |
| Phụ huynh, SĐT phụ huynh | ✓ | ✓ | – | – |
| Hồ sơ giáo viên | Sửa | Xem | Của mình | Của mình |
| Cài đặt, tài khoản | ✓ | – | – | – |
| Lịch sử thay đổi | ✓ | ✓ | – | – |

Quy tắc nằm ở `src/lib/permissions.ts`. Giáo vụ sửa được phụ huynh có con ở trung tâm mình. Điểm danh: người dạy và trợ giảng của buổi, giáo vụ trung tâm của lớp, quản lý; chỉ từ ngày học trở đi. Xếp học bù: giáo vụ trung tâm chính của học sinh và quản lý.

**Quy tắc đang áp dụng** (theo tài liệu yêu cầu, mục 5):

- Chặn trùng phòng.
- Chặn một người (giáo viên hoặc trợ giảng) dạy hai buổi trùng giờ ở hai trung tâm khác nhau; cùng trung tâm thì cho phép.
- Chặn xếp học sinh vào lớp đã đủ chỗ (sĩ số tối đa hoặc sức chứa phòng, lấy số nhỏ hơn) và vào hai lớp trùng giờ.
- Cảnh báo, không chặn: xếp lớp cho học sinh còn nợ khóa trước; mở lớp mà giáo viên dạy hai trung tâm cách nhau dưới 60 phút.
- Học sinh, giáo viên, lớp không xóa; kết thúc bằng đổi trạng thái.
- Thay đổi quan trọng được ghi nhật ký (ai, lúc nào, từ gì thành gì), ghi tên người đang đăng nhập.

## Chưa có

Xem mục 2 của [docs/KE_HOACH.md](docs/KE_HOACH.md): ảnh học sinh và file đính kèm (cần chốt nơi lưu file khi đưa lên mạng), quản lý bỏ qua lệnh chặn trong trường hợp đặc biệt (chờ trả lời câu hỏi mục 7 tài liệu yêu cầu); giai đoạn 2 (cổng phụ huynh, tuyển sinh).

## Cấu trúc

```
prisma/schema.prisma     mô hình dữ liệu
prisma/seed.ts           dữ liệu mẫu
src/lib/                 logic thuần (sinh lịch, kiểm tra trùng, bỏ dấu, ngày tháng) — có test
src/server/              truy cập DB, kiểm tra dữ liệu (zod), nhật ký
src/app/api/             API REST
src/app/**/page.tsx      các màn hình
src/components/          thành phần giao diện dùng chung
tests/                   test Vitest
```

Ngày lưu dạng `YYYY-MM-DD`, giờ dạng `HH:mm` theo giờ Việt Nam, để không lệch múi giờ.

## Đưa lên mạng (sau)

Đổi `provider` trong `prisma/schema.prisma` sang `postgresql`, đặt `DATABASE_URL` trỏ tới PostgreSQL, chạy `npx prisma migrate deploy`. Nên chạy qua HTTPS; khi đó cookie đăng nhập tự bật `Secure`. Không chạy `db:seed` trên máy thật vì nó xóa dữ liệu và tạo tài khoản mẫu.
