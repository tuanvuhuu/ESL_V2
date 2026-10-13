# DESIGN.md – Hệ thống quản lý 4 trung tâm tiếng Anh

> Phạm vi file: định hướng thiết kế giao diện (UI/UX) cho **Đợt 1**: Học sinh, Phụ huynh, Giáo viên/Trợ giảng, Lịch học.
> Chưa bao gồm: database, API, kiến trúc kỹ thuật.
> Tài liệu nghiệp vụ gốc: "Yêu cầu nghiệp vụ – Hệ thống quản lý 4 trung tâm tiếng Anh" (tab Tổng quan + tab Đặc tả đợt 1).

---

## 1. Hệ thống thiết kế: GitHub Primer (một nguồn duy nhất)

| Tiêu chí | Lựa chọn |
|---|---|
| Hệ thống thiết kế | **GitHub Primer**: `@primer/react` (component), `@primer/octicons-react` (icon), `@primer/primitives` (token màu, bo góc, bóng, phông chữ) |
| Lịch sử | Bản đầu dùng Ant Design v5; đã chuyển hẳn sang Primer từ 12/10/2026. Trong code không còn Ant Design |
| Lý do | Gọn, phẳng, dễ đọc, hợp phần mềm quản trị dùng hằng ngày; bảng dữ liệu (DataTable) và menu thao tác có sẵn |

**Quy tắc một nguồn (luật lint kiểm tra tự động, CI báo lỗi nếu vi phạm):**

1. **Component:** màn hình và component nghiệp vụ chỉ lấy component từ bộ kit `src/client/primer-compat.tsx`, icon từ `src/client/primer-icons.tsx`. Bộ kit bọc Primer React. Chỉ các file khung (`AppShell`, `PrimerGrid`, `PrimerModal`, `Providers`, `ui.tsx`) được gọi thẳng `@primer/react`.
2. **Màu:** không viết mã hex trong code giao diện. Dùng token Primer `var(--fgColor-…)`, `var(--bgColor-…)`, `var(--borderColor-…)` hoặc hằng `COLORS` trong `src/lib/colors.ts`. Nền nhạt từ một màu: `tint(màu, %)`. Ngoại lệ duy nhất: màu nhận diện trung tâm (lưu trong database).
3. **CSS:** `globals.css` chỉ dùng biến của Primer, không tự định nghĩa bảng màu riêng.
4. Chỉ tự làm khi Primer không có (lưới lịch phòng theo giờ, lưới lịch rảnh), và vẫn dùng token Primer.

---

## 2. Nguyên tắc thiết kế

1. **Ít thao tác cho việc hằng ngày.** Điểm danh, tìm học sinh, xem lịch hôm nay: tối đa 2–3 lần chạm.
2. **Tìm kiếm ở khắp nơi.** Ô tìm toàn cục trên thanh trên cùng: gõ tên (không dấu cũng được), mã, hoặc SĐT phụ huynh.
3. **Một hồ sơ – một trang.** Trang hồ sơ học sinh/giáo viên gom đủ thông tin, chia tab, không nhảy qua nhiều màn hình.
4. **Báo lỗi rõ ràng, chặn đúng chỗ.** Khi bị chặn (trùng phòng, trùng giờ), nói rõ trùng với lớp nào, giờ nào, và gợi ý cách sửa.
5. **Giáo viên dùng điện thoại, văn phòng dùng máy tính.** Màn hình giáo viên ưu tiên di động; màn hình giáo vụ/quản lý ưu tiên máy tính.
6. **Màu dùng có nghĩa.** Mỗi trung tâm một màu nhận diện; trạng thái có màu cố định trên toàn hệ thống.
7. **Không làm người dùng sợ bấm nhầm.** Thao tác quan trọng có xác nhận; thao tác thường có "Hoàn tác" trong vài giây.

---

## 3. Nền tảng thị giác (design tokens)

### 3.1 Màu chính (token Primer, chế độ sáng)

| Ý nghĩa | Token chữ / nền nhạt | Giá trị (sáng) | Dùng cho |
|---|---|---|---|
| Chính (accent) | `--fgColor-accent` / `--bgColor-accent-muted` | `#0969DA` | Nút chính, liên kết, mục đang chọn, vắng có phép |
| Thành công | `--fgColor-success` / `--bgColor-success-muted` | `#1A7F37` | Có mặt, đang học, đã lưu |
| Cảnh báo | `--fgColor-attention` / `--bgColor-attention-muted` | `#9A6700` | Đi muộn, sắp hết buổi |
| Lỗi | `--fgColor-danger` / `--bgColor-danger-muted` | `#D1242F` | Bị chặn, vắng không phép, đã hủy |
| Học bù / dạy thay | `--fgColor-done` / `--bgColor-done-muted` | `#8250DF` | Học bù, dạy thay, bảo lưu |
| Trung tính | `--fgColor-muted` | `#59636E` | Chờ xếp lớp, chữ phụ |
| Nền trang / khối | `--bgColor-muted` / `--bgColor-default` | `#F6F8FA` / `#FFFFFF` | |
| Chữ chính | `--fgColor-default` | `#1F2328` | |
| Viền | `--borderColor-default` / `--borderColor-muted` | | |

Trong code dùng `COLORS.accent`, `COLORS.success`… (`src/lib/colors.ts`), không ghi giá trị hex. Chế độ tối sau này chỉ cần nạp thêm theme tối của `@primer/primitives`.

### 3.2 Màu nhận diện 4 trung tâm

Dùng cho nhãn trung tâm, viền thẻ buổi học trên lịch, biểu đồ.

| Trung tâm | Màu |
|---|---|
| Trung tâm A | `#1F6FEB` xanh dương |
| Trung tâm B | `#2DA44E` xanh lá |
| Trung tâm C | `#BF5AF2` tím |
| Trung tâm D | `#F0883E` cam |

*(Tên và màu chốt lại khi có tên trung tâm thực tế.)*

### 3.3 Màu trạng thái cố định

| Nhóm | Trạng thái → màu nhãn |
|---|---|
| Học sinh | Chờ xếp lớp: xám · Đang học: xanh lá · Bảo lưu: tím · Tạm nghỉ: vàng · Đã kết thúc: xanh dương · Đã nghỉ: đỏ |
| Lớp | Dự kiến: xám · Đang học: xanh lá · Tạm dừng: vàng · Đã kết thúc: xanh dương · Đã hủy: đỏ |
| Buổi học | Sắp diễn ra: viền thường · Đã diễn ra: nền nhạt · Đã hủy: gạch ngang + đỏ · Dạy thay / học bù: tím |
| Điểm danh | Có mặt: xanh lá · Đi muộn: vàng · Vắng có phép: xanh dương · Vắng không phép: đỏ |
| Giáo viên | Đang làm: xanh lá · Tạm nghỉ: vàng · Đã nghỉ việc: xám |

### 3.4 Chữ

| Mục | Giá trị |
|---|---|
| Font | **Be Vietnam Pro** (dấu tiếng Việt chuẩn, dễ đọc), gán vào `--fontStack-system` của Primer; dự phòng: phông hệ thống |
| Cỡ chữ gốc | 14px (máy tính), 16px (di động) |
| Tiêu đề trang / khối | 20px / 16px, đậm 600 |
| Số liệu (buổi còn lại, giờ dạy) | Font số đều độ rộng (`tabular-nums`) để cột thẳng hàng |

### 3.5 Khoảng cách và bo góc

- Lưới khoảng cách bội số 4px: 4 · 8 · 12 · 16 · 24 · 32.
- Bo góc theo token Primer: `--borderRadius-small` 3px, `--borderRadius-medium` 6px (nút, ô nhập, thẻ), `--borderRadius-large` 12px.
- Bóng đổ: `--shadow-resting-*` (thẻ), `--shadow-floating-*` (menu, ngăn kéo).
- Mật độ: nút và ô nhập cỡ `medium` của Primer; trong bảng dùng `small`.

### 3.6 Định dạng Việt Nam

| Loại | Định dạng |
|---|---|
| Ngày | `dd/mm/yyyy`, kèm thứ khi xem lịch: "T2, 12/10/2026" |
| Giờ | 24 giờ: `18:00–19:30` |
| Tiền | `1.500.000 ₫` (dấu chấm ngăn cách hàng nghìn) |
| Số điện thoại | `0912 345 678` |
| Tuần | Bắt đầu từ Thứ 2 |
| Tìm kiếm | Không phân biệt dấu và hoa thường |

---

## 4. Bố cục chung

### 4.1 Máy tính (giáo vụ, quản lý)

```
┌──────────────────────────────────────────────────────────────┐
│ Logo │ [Bộ chọn trung tâm ▼] │ 🔍 Tìm HS / PH / GV   │ 🔔 │ 👤 │
├────────────┬─────────────────────────────────────────────────┤
│ Menu trái  │ Tiêu đề trang                   [Nút hành động] │
│            │ Bộ lọc                                          │
│ Tổng quan  │ ┌─────────────────────────────────────────────┐ │
│ Lịch học   │ │ Nội dung: bảng / lịch / hồ sơ               │ │
│ Lớp học    │ │                                             │ │
│ Học sinh   │ └─────────────────────────────────────────────┘ │
│ Phụ huynh  │                                                 │
│ Giáo viên  │                                                 │
│ Cài đặt    │                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

- **Bộ chọn trung tâm** luôn ở thanh trên: Quản lý chọn "Tất cả" hoặc một trung tâm; giáo vụ mặc định trung tâm mình.
- Menu trái thu gọn được thành biểu tượng.
- Primer: `NavList` (menu trái), `ActionMenu` + `ActionList` (bộ chọn trung tâm, menu người dùng), `Breadcrumbs`, `TextInput` (ô tìm).

### 4.2 Di động (giáo viên, trợ giảng)

- Thanh điều hướng dưới cùng 4 mục: **Hôm nay · Lịch · Lớp của tôi · Tài khoản**.
- Mọi nút bấm cao tối thiểu 44px.
- Không dùng bảng nhiều cột trên di động; chuyển thành danh sách thẻ.

### 4.3 Điểm ngắt màn hình

| Kích thước | Bố cục |
|---|---|
| < 768px | Di động: 1 cột, menu dưới |
| 768–1199px | Máy tính bảng: menu trái thu gọn |
| ≥ 1200px | Máy tính: đầy đủ |

---

## 5. Mẫu giao diện dùng chung

| Mẫu | Mô tả | Bộ kit (`primer-compat`) → Primer |
|---|---|---|
| Trang danh sách | Theo mẫu chuẩn mục 5A: tiêu đề + nút · thanh lọc · bảng có cột ghim · menu ⋯ · phân trang | `Table` → `PrimerGrid` (DataTable + Pagination) |
| Bộ lọc | Lọc nhanh dạng nhãn có số lượng + chọn trung tâm | `Segmented` → `SegmentedControl`; `Select` |
| Trang hồ sơ | Đầu trang + các tab | `Tabs` → `UnderlineNav`; `Tag` → `Label` |
| Thêm / sửa nhanh | Ngăn trượt từ phải, không rời trang (mục 5A.6) | `Modal` → `PrimerModal` (tự dựng) |
| Thao tác trên một dòng | Nút ⋯ cuối dòng (mục 5A.5) | `ActionMenu` (ui.tsx) → `ActionMenu` + `ActionList` |
| Cài đặt cột | Nút "Cột": ẩn/hiện, ghim cột (mục 5A.4) | `ColumnSettings` |
| Biểu mẫu | Chia nhóm có tiêu đề; trường bắt buộc có dấu `*` | `Form`, `Input`, `Select`, `DatePicker` → `FormControl`, `TextInput`, `Select` |
| Xác nhận | Hộp thoại nêu rõ hậu quả | `Popconfirm`, `App.useApp().modal.confirm` → `ConfirmationDialog` |
| Bị chặn / cảnh báo | Thông báo đỏ / vàng trong biểu mẫu | `Alert` → `Flash` |
| Lịch sử thay đổi | Dòng thời gian | `Timeline` → `Timeline` |
| Trạng thái trống | Câu hướng dẫn + nút hành động | `Empty` → `Blankslate` |
| Đang tải | Khung xương | `Skeleton` → `SkeletonText` |
| Thông báo nhỏ | Sau khi lưu: "Đã lưu" | `message` → toast tự dựng (Primer không có toast) |

---|---|---|
| Trang danh sách | Theo mẫu chuẩn mục 5A: tiêu đề + nút · thanh lọc · bảng có cột ghim · menu ⋯ · phân trang | `Table`, `Form` (lọc), `Pagination` |
| Bộ lọc | Lọc nhanh dạng nhãn có số lượng (Đang học 12 / Bảo lưu 3…) + chọn trung tâm | `Segmented`, `Select` |
| Trang hồ sơ | Đầu trang (ảnh, tên, mã, nhãn trạng thái, hành động) + các tab | `Descriptions`, `Tabs`, `Tag` |
| Thêm / sửa nhanh | Popup giữa màn hình, không rời trang (mục 5A.6) | `Modal` + `Form` |
| Thao tác trên một dòng | Nút ba chấm ngang ⋯ ở cuối dòng, bấm mở danh sách thao tác (mục 5A.5) | `Dropdown` + `Menu` |
| Cài đặt cột | Nút "▥ Cột": ẩn/hiện, ghim trái/phải từng cột (mục 5A.4) | `Popover` + `Checkbox` + `Segmented` |
| Biểu mẫu dài | Chia nhóm có tiêu đề; trường bắt buộc có dấu `*` | `Form`, `Card` |
| Xác nhận | Hộp thoại nêu rõ hậu quả: "Hủy buổi 12/10 – 8 học sinh sẽ không bị trừ buổi" | `Modal.confirm` |
| Bị chặn | Thông báo đỏ trong biểu mẫu + liên kết tới lớp bị trùng | `Alert type="error"` |
| Cảnh báo | Thông báo vàng, vẫn cho lưu | `Alert type="warning"` |
| Lịch sử thay đổi | Dòng thời gian: thời điểm · người · từ gì thành gì | `Timeline` |
| Trạng thái trống | Hình minh họa nhẹ + câu hướng dẫn + nút hành động | `Empty` |
| Đang tải | Khung xương thay vì vòng quay | `Skeleton` |
| Thông báo nhỏ | Sau khi lưu: "Đã lưu" + "Hoàn tác" (5 giây) | `message`, `notification` |

---

## 5A. Mẫu chuẩn: Trang danh sách (Data grid)

Mọi trang danh sách (học sinh, phụ huynh, giáo viên, lớp, phòng…) dùng chung mẫu này. Bản mẫu chạy được: **`quan-ly-hoc-sinh.html`** (mở trực tiếp bằng trình duyệt).

### 5A.1 Bố cục

```
Học sinh                                          [⭳ Xuất Excel] [＋ Thêm học sinh]
Quản lý hồ sơ học sinh của 4 trung tâm
┌──────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Tìm tên, mã, SĐT…] [Tất cả trung tâm ▼] [Tất cả 37│Đang học 18│…]  [▥ Cột] │
├───────┬──────────────┬─────────────── cuộn ngang ───────────────┬────────────┤
│ Mã 📌 │ Học sinh 📌  │ Tuổi · Trung tâm · Lớp · Trạng thái · … │     ⋯      │
│ (ghim trái)          │                                          │ (ghim phải)│
├───────┴──────────────┴──────────────────────────────────────────┴────────────┤
│ 1–10 trong 37 học sinh                          ‹ 1 2 3 4 › [10 / trang ▼]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Vùng | Quy chuẩn |
|---|---|
| Đầu trang | Tiêu đề 20px + dòng mô tả 13px màu phụ; nút phụ bên trái, **nút chính (Thêm) ngoài cùng bên phải** |
| Thanh lọc | Ô tìm (280px) · chọn trung tâm · lọc nhanh trạng thái · khoảng trống · nút "▥ Cột" sát phải |
| Bảng | Nằm trong khối nền trắng bo 8px; cao tối đa = màn hình − 230px, cuộn bên trong |
| Chân bảng | Trái: "1–10 trong 37 học sinh" · Phải: phân trang + chọn số dòng (10 / 20 / 50) |

### 5A.2 Tìm kiếm và lọc

- Tìm **ngay khi gõ**, không cần nhấn Enter; không phân biệt dấu và hoa thường ("nguyen" tìm ra "Nguyễn").
- Tìm theo: tên, mã, tên tiếng Anh, tên phụ huynh, SĐT phụ huynh (từ 3 chữ số trở lên, bỏ qua dấu cách).
- Lọc nhanh trạng thái dạng nhãn, **mỗi nhãn kèm số lượng**; số lượng cập nhật theo trung tâm đang chọn.
- Đổi bộ lọc thì về trang 1.
- Không có kết quả: hiện "Không tìm thấy học sinh phù hợp." + nút **Xóa bộ lọc**.

### 5A.3 Bảng dữ liệu

| Mục | Quy chuẩn |
|---|---|
| Ô | Đệm 12px × 16px; đường kẻ ngang mảnh `#EEF1F4`, không kẻ dọc |
| Tiêu đề | Nền `#FAFBFC`, chữ đậm 600, **cố định khi cuộn dọc** |
| Dòng | Rê chuột: nền `#F3F7FF` (áp dụng cả ô đang ghim) |
| Sắp xếp | Bấm tiêu đề cột: tăng ↑ → giảm ↓; cột đang sắp xếp mũi tên màu chính, cột khác hiện ↕ mờ |
| Cột số | Font số đều độ rộng (`tabular-nums`) |
| Ô hai dòng | Dòng chính 14px + dòng phụ 12px màu phụ (VD: tên + tên tiếng Anh, tuổi + ngày sinh, tên phụ huynh + SĐT) |
| Ảnh đại diện | Tròn 32px; chưa có ảnh thì hiện chữ cái đầu của tên trên **màu trung tâm** |
| Trạng thái | Nhãn viền màu trạng thái (mục 3.3), chữ cùng màu, nền nhạt 7%; lý do nghỉ hiện dòng phụ bên dưới |
| Buổi còn lại | Số đậm "còn lại / tổng" + thanh tiến độ 90×6px; **còn ≤ 3 buổi và đang học → màu cảnh báo** |
| Ô trống | Dấu "—" màu phụ, không để trắng |
| Không có nút Xóa | Học sinh, giáo viên, lớp không xóa từ bảng; muốn kết thúc thì **đổi trạng thái** |

### 5A.4 Ghim cột và cài đặt cột

**Mặc định**

| Cột | Vị trí |
|---|---|
| Mã, Học sinh (tên chính của đối tượng) | Ghim trái |
| Thao tác ⋯ | Ghim phải |
| Các cột còn lại | Cuộn ngang ở giữa |

**Bảng "▥ Cột"** (mở dưới nút, canh phải theo nút, rộng 340px)
- Mỗi cột một dòng: ô tích **ẩn/hiện** + nhóm 3 nút **⇤ Trái · — · Phải ⇥**.
- Cột bắt buộc (Thao tác) không ẩn được, nhưng vẫn đổi được vị trí ghim. Cột đang ẩn thì nhóm nút ghim mờ đi.
- Ghim được **nhiều cột cùng một bên**; các cột ghim xếp sát nhau theo thứ tự gốc. Cột ghim trái luôn đứng đầu bảng, ghim phải luôn đứng cuối.
- Chân bảng: "Ghim trái 2 · ghim phải 1" + nút **Khôi phục mặc định**.
- Đóng khi bấm ra ngoài, nhấn Esc hoặc nút ×.
- **Lưu cài đặt theo từng người dùng**, lần sau mở lại vẫn giữ (bản mẫu lưu trên trình duyệt; bản thật lưu theo tài khoản).

**Hiển thị cột ghim**
- Tiêu đề cột đang ghim có biểu tượng 📌 nhỏ.
- Khi cuộn ngang, mép trong của nhóm cột ghim hiện **bóng mờ** để biết đang có nội dung bị che phía dưới; về sát mép thì bóng tắt.
- Ô tiêu đề ghim nằm trên cùng khi vừa cuộn dọc vừa cuộn ngang.

### 5A.5 Menu thao tác (nút ⋯)

- Nút **ba chấm ngang ⋯**, 32×32px, không viền; rê chuột hoặc đang mở thì nền xám nhạt.
- Bấm mở danh sách thao tác **canh phải theo nút**; gần cuối màn hình thì **tự mở lên trên**.
- Đầu menu ghi **tên + mã** của dòng đang chọn để tránh thao tác nhầm người.
- Thứ tự nhóm, ngăn bằng đường kẻ:
  1. **Xem / sửa:** Xem hồ sơ · Sửa thông tin · Đổi trạng thái
  2. **Liên hệ:** Gọi phụ huynh · Sao chép SĐT phụ huynh
  3. **Thao tác theo trạng thái** (chỉ hiện khi hợp lệ): Bảo lưu (khi đang học) · Học lại (khi bảo lưu/tạm nghỉ) · **Cho nghỉ học** (chữ đỏ, ẩn khi đã nghỉ)
- Thao tác nguy hiểm luôn **ở cuối, chữ đỏ**, và luôn mở popup xác nhận chứ không thực hiện ngay.
- Đóng khi: chọn một mục, bấm ra ngoài, nhấn Esc, cuộn trang. Phím ↑ ↓ di chuyển giữa các mục.

Các trang khác dùng cùng khung, thay nội dung nhóm. Ví dụ giáo viên: Xem hồ sơ · Sửa · Đổi trạng thái | Gọi điện · Sao chép SĐT | Đăng ký ngày nghỉ · Xem lịch dạy | Cho nghỉ việc.

### 5A.6 Popup

| Popup | Rộng | Nội dung |
|---|---|---|
| Thêm / sửa | 720px | Biểu mẫu chia nhóm có tiêu đề, lưới 2 cột (di động 1 cột) |
| Xem nhanh | 560px | Đầu: ảnh 48px + tên + nhãn trạng thái + nhãn trung tâm; thân: bảng nhãn – giá trị; chân: Đóng · **Sửa** |
| Đổi trạng thái | 440px | Trạng thái mới · lý do (bắt buộc khi "Đã nghỉ") · ghi chú; dòng nhắc "được lưu vào lịch sử" |

**Quy chuẩn chung**
- Lớp phủ đen 45%; popup cách đỉnh 60px, bo 8px; dài thì cuộn cả lớp phủ.
- Đầu: tiêu đề 16px + nút ×. Chân: nút phụ bên trái, **nút chính ngoài cùng bên phải**.
- Tiêu đề nêu rõ đối tượng: "Sửa học sinh · HS001023", "Đổi trạng thái · Nguyễn Minh An".
- Mở ra thì con trỏ nằm sẵn ở ô đầu tiên.
- Đóng bằng ×, nút Hủy, Esc hoặc bấm ra lớp phủ.

**Biểu mẫu thêm/sửa học sinh**

| Nhóm | Trường (`*` = bắt buộc) |
|---|---|
| Thông tin học sinh | Họ và tên* · Tên tiếng Anh · Ngày sinh* · Giới tính* · Nhóm đối tượng* · Trường đang học |
| Trung tâm và trạng thái | Trung tâm chính* · Trạng thái* · Lý do* (chỉ hiện khi "Đã nghỉ") |
| Phụ huynh chính | SĐT* · Họ tên phụ huynh* · Quan hệ* · Zalo · Ghi chú |

- Thêm mới: trạng thái mặc định "Chờ xếp lớp"; trung tâm mặc định theo bộ lọc đang chọn.
- Dòng nhắc cuối biểu mẫu: thông tin chi tiết khác bổ sung sau trong hồ sơ.

### 5A.7 Kiểm tra và hỗ trợ nhập liệu

| Tình huống | Cách hiển thị |
|---|---|
| Thiếu trường bắt buộc | Viền đỏ + chữ đỏ 12px dưới ô ("Nhập họ và tên"); con trỏ nhảy về ô lỗi đầu tiên |
| SĐT sai | "SĐT gồm 10 số, bắt đầu bằng 0" (cho phép gõ có dấu cách) |
| Ngày sinh ở tương lai | "Ngày sinh không được ở tương lai" |
| Trùng tên + ngày sinh | Hộp **vàng** đầu popup: "Có thể trùng hồ sơ: … Kiểm tra lại trước khi lưu." — vẫn cho lưu |
| SĐT phụ huynh đã có | Hộp **xanh** trên nhóm phụ huynh: "SĐT này thuộc phụ huynh … (con: …)" + nút **Dùng thông tin này** → tự điền và liên kết anh chị em |

### 5A.8 Phản hồi sau thao tác

- Thông báo nhỏ ở giữa đỉnh màn hình, tự tắt sau 2,5 giây: "Đã thêm …", "Đã cập nhật …", "Nguyễn Minh An: Bảo lưu", "Đã sao chép 0912 345 678".
- Thêm mới xong: bảng về trang 1, sắp xếp mã giảm dần để thấy ngay dòng vừa thêm.
- Xuất Excel: xuất **đúng danh sách đang lọc**, tiêu đề cột tiếng Việt, mở đúng dấu trong Excel.

---

## 6. Màn hình Đợt 1

### 6.1 Học sinh

**Danh sách học sinh** — theo mẫu chuẩn mục 5A, bản mẫu `quan-ly-hoc-sinh.html`
- Cột: mã 📌 · học sinh (ảnh, họ tên, tên tiếng Anh) 📌 · tuổi (+ ngày sinh) · trung tâm · lớp đang học · trạng thái (+ lý do) · phụ huynh chính (+ quan hệ, SĐT) · buổi còn lại · ⋯ 📌.
- Lọc nhanh theo trạng thái; lọc thêm: trung tâm. Giai đoạn sau: lớp, khóa, độ tuổi, trường, người phụ trách.
- Nút trên trang: Xuất Excel · Thêm học sinh. Giai đoạn sau: chọn nhiều dòng để xếp lớp hàng loạt.

**Thêm / sửa học sinh (popup)** — biểu mẫu và kiểm tra theo mục 5A.6–5A.7.
- Giai đoạn sau: thêm nút "Lưu & mở hồ sơ" để bổ sung thông tin chi tiết ngay.

**Hồ sơ học sinh – các tab**
1. **Tổng quan:** thông tin chính, phụ huynh (bấm gọi), anh chị em, lớp đang học kèm thanh tiến độ buổi (đã học / tổng), lịch 2 tuần tới, chuyên cần 10 buổi gần nhất (dãy chấm màu).
2. **Lịch sử khóa học:** danh sách khóa theo thời gian, mở ra xem chi tiết điểm danh từng buổi.
3. **Thông tin chi tiết:** toàn bộ trường ở tab Đặc tả đợt 1, mục 1.1–1.2.
4. **Liên lạc:** nhật ký liên lạc + nút "Ghi liên lạc".
5. **Tài liệu:** file đính kèm.
6. **Lịch sử thay đổi.**

### 6.2 Phụ huynh

- **Danh sách:** họ tên · SĐT · Zalo · số con · tên các con · trung tâm.
- **Hồ sơ phụ huynh:** thông tin liên hệ; thẻ từng con (lớp, lịch, trạng thái); nhật ký liên lạc chung.
- **Ghi liên lạc (popup):** chọn con, hình thức, chủ đề, nội dung, ngày hẹn gọi lại.
- **Việc cần gọi lại:** danh sách theo ngày, nhóm "Quá hạn / Hôm nay / Sắp tới".

### 6.3 Giáo viên và trợ giảng

- **Danh sách:** ảnh · tên hiển thị · vai trò · loại (VN/nước ngoài) · trung tâm · số lớp đang dạy · giờ dạy tháng này · trạng thái; biểu tượng cảnh báo khi chứng chỉ/hợp đồng sắp hết hạn.
- **Hồ sơ – các tab:** Tổng quan (lớp đang dạy, lịch tuần) · Thông tin & chuyên môn · Lịch rảnh · Ngày nghỉ · Giờ dạy · Lịch sử.
- **Lịch rảnh:** lưới tuần (Thứ 2 → CN × khung giờ), kéo để tô vùng rảnh, chọn trung tâm cho từng vùng.
- **Đăng ký ngày nghỉ:** chọn khoảng ngày → hiện ngay danh sách buổi bị ảnh hưởng, mỗi buổi có nút "Tìm người dạy thay".
- **Tìm người dạy thay (hộp thoại):** danh sách người phù hợp, sắp theo mức phù hợp; nhãn "Rảnh", "Ngoài lịch rảnh", "Chưa dạy khóa này".

### 6.4 Lịch học

**Lịch phòng theo ngày (màn hình chính của giáo vụ)**
```
            08:00   09:00   ...   17:00     18:00          19:00     20:00
P101        │                    │ KID2-Lions (Ms Lan)    │ IELTS-A (Mr John) │
P102        │ ...                │        [trống]         │ TEENS1 (Ms Hoa)   │
P201        │                    │ GT-B (Mr Nam) ⚠ dạy thay│                 │
```
- Hàng = phòng, cột = giờ. Thẻ buổi học có viền màu trung tâm, nhãn trạng thái.
- Bấm vùng trống → tạo buổi/lớp tại phòng và giờ đó.
- Bấm thẻ buổi → ngăn bên: thông tin buổi, danh sách học sinh, các nút Hủy / Dời / Đổi phòng / Dạy thay.
- Kéo thả thẻ để dời buổi; hệ thống kiểm tra trùng ngay khi thả.
- Đây là thành phần **tự xây** (Primer không có sẵn dạng lưới phòng × giờ), dùng token Primer.

**Lịch tuần:** chọn chế độ xem theo trung tâm / giáo viên / phòng / học sinh. Dùng `Calendar` hoặc lưới tuần tự xây.

**Lịch hôm nay – 4 trung tâm (quản lý):** 4 cột trung tâm, mỗi cột danh sách buổi theo giờ; đánh dấu bị hủy, dạy thay, chưa điểm danh.

**Mở lớp mới – biểu mẫu từng bước** (`Steps`)
1. Khóa học, trung tâm, tên lớp, sĩ số.
2. Lịch lặp: chọn thứ và giờ; nút **"Tìm khung giờ trống"** gợi ý khung còn phòng và người dạy.
3. Giáo viên, trợ giảng (chỉ hiện người hợp lệ; người bị trùng hiện mờ kèm lý do).
4. Xem trước toàn bộ danh sách buổi (đã bỏ ngày lễ), ngày kết thúc dự kiến → Xác nhận.

**Hồ sơ lớp – các tab:** Tổng quan · Học sinh (ngày vào/rời lớp) · Buổi học (danh sách đủ các buổi, trạng thái từng buổi) · Giáo viên & trợ giảng · Lịch sử thay đổi.

**Hủy / dời buổi (hộp thoại)**
- Hủy: lý do, tùy chọn "Nối một buổi vào cuối lịch", ô "Đã báo phụ huynh".
- Dời: chọn ngày giờ mới; kết quả kiểm tra hiện ngay (xanh: hợp lệ · vàng: cảnh báo · đỏ: bị chặn kèm lý do).

**Ngày nghỉ lễ:** danh sách theo năm; thêm ngày nghỉ → hiện số buổi bị ảnh hưởng và nút "Dời tất cả ra cuối lịch".

**Học bù:** từ buổi học sinh vắng → nút "Xếp học bù" → gợi ý buổi tương ứng ở lớp khác (cùng bài, còn chỗ, trung tâm gần) hoặc tạo buổi bù riêng. Danh sách "Buổi vắng chưa bù" có bộ lọc theo trung tâm.

### 6.5 Màn hình giáo viên (di động)

- **Hôm nay:** thẻ các buổi trong ngày theo giờ: giờ · lớp · phòng · trung tâm · vai trò · bài học hôm nay.
- **Điểm danh:** danh sách học sinh có ảnh; mặc định "Có mặt", chạm để đổi trạng thái theo vòng (Có mặt → Muộn → Vắng có phép → Vắng không phép); học sinh học bù có nhãn tím; nút "Lưu" cố định cuối màn hình.
- **Nhận xét nhanh:** ô nhận xét ngắn cho từng học sinh, có câu mẫu chọn nhanh.
- **Lịch:** tuần này / tuần sau, gộp mọi trung tâm.
- **Tài khoản:** thông tin, lịch rảnh, đăng ký nghỉ, giờ dạy tháng.

*(Điểm danh và nhận xét chi tiết thuộc đợt sau, nhưng thiết kế sẵn ở đây để giáo viên dùng ngay khi đợt 1 xong.)*

---

## 7. Phân quyền hiển thị

| Màn hình / dữ liệu | Quản lý | Giáo vụ | Giáo viên | Trợ giảng |
|---|---|---|---|---|
| Bộ chọn "Tất cả trung tâm" | ✓ | – | – | – |
| Hồ sơ học sinh trung tâm mình | Sửa | Sửa | Xem (lớp mình) | Xem (lớp mình) |
| Hồ sơ học sinh trung tâm khác | Sửa | Xem *(chờ chốt)* | – | – |
| SĐT phụ huynh | ✓ | ✓ | *(chờ chốt)* | *(chờ chốt)* |
| Lưu ý sức khỏe học sinh | ✓ | ✓ | Lớp mình | Lớp mình |
| Đơn giá giờ, tài khoản lương, đánh giá nội bộ GV | ✓ | – | Của mình | Của mình |
| Mở lớp, sửa lịch | ✓ | ✓ | – | – |
| Lịch rảnh, ngày nghỉ | ✓ | ✓ | Của mình *(chờ chốt)* | Của mình *(chờ chốt)* |

Mục người dùng không có quyền thì **ẩn hẳn**, không hiện rồi báo lỗi.

---

## 8. Nội dung chữ trên giao diện

- Xưng hô trung tính, ngắn gọn: "Lưu", "Thêm học sinh", không "Vui lòng nhấn vào đây để…".
- Thông báo bị chặn có 3 phần: **chuyện gì** · **vì sao** · **làm gì tiếp**.
  Ví dụ: *"Không thể lưu: Phòng P201 đã có lớp KID2-Lions lúc 18:00–19:30 T4, 14/10. Chọn phòng khác hoặc giờ khác."*
- Thông báo cảnh báo: *"Ms Lan không có lịch rảnh khung này. Vẫn lưu?"*
- Trạng thái trống: *"Chưa có học sinh nào trong lớp. Thêm học sinh để bắt đầu."*
- Thống nhất thuật ngữ: Học sinh · Phụ huynh · Giáo viên · Trợ giảng · Lớp · Buổi học · Học bù · Dạy thay · Bảo lưu.

---

## 9. Khả năng tiếp cận

- Tương phản chữ/nền tối thiểu 4.5:1.
- Trạng thái không chỉ dựa vào màu: luôn có chữ hoặc biểu tượng đi kèm.
- Dùng được bằng bàn phím trên máy tính (Tab, Enter, Esc đóng ngăn/hộp thoại).
- Vùng chạm tối thiểu 44×44px trên di động.

---

## 10. Việc cần chốt trước khi vẽ giao diện chi tiết

- [x] Hệ thống thiết kế: GitHub Primer (đã chuyển từ Ant Design ngày 12/10/2026).
- [ ] Tên, logo, màu thương hiệu của tổ chức và màu từng trung tâm.
- [ ] Giáo vụ dùng máy tính bàn hay cả máy tính bảng tại quầy?
- [ ] Giáo viên dùng trình duyệt trên điện thoại là đủ, hay cần ứng dụng cài đặt?
- [ ] Các mục *(chờ chốt)* ở bảng phân quyền mục 7.
