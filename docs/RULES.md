# Luật chung cho mọi lượt chạy chung

Áp dụng cho mọi công cụ làm việc trong repo này: Claude Code trên máy (NOVA), Antigravity, các thread Claude trên cloud. File này đứng trên mọi file quy tắc khác; chỗ nào khác với file này thì làm theo file này.

## Nhánh

1. Mọi commit của lượt chạy chung chỉ vào nhánh **`common`**. Không commit hay push vào `main` hay bất kỳ nhánh nào khác.
2. Trước khi bắt đầu: `git fetch origin && git checkout common && git pull origin common`.
3. Đẩy lên: `git push origin common`. Không `--force`, không xóa nhánh, không sửa lịch sử commit.

## Commit

4. Tiền tố commit:
   - `done(Bx): ...` khi một việc xong và đạt điều 5.
   - `wip(Bx): ...` khi phải dừng giữa chừng.
5. Trước mỗi commit `done`: `npm run lint && npm run typecheck && npm test` phải xanh.
6. Commit xong là push ngay để công cụ khác thấy.

## Tiến độ

7. Mỗi việc xong: đánh `[x]` trong `docs/TIEN_DO.md`, ghi một dòng Nhật ký, xóa mục Bàn giao của việc đó.
8. Công cụ hết lượt (hết hạn mức, lỗi, phải dừng): commit `wip`, ghi phần **Bàn giao** trong `docs/TIEN_DO.md` (đã làm gì, còn gì, đang vướng gì, file đang sửa), push, rồi dừng.

## Dữ liệu

9. Không chạy `npm run db:reset`, `prisma db push --force-reset`, `prisma migrate reset` hay bất kỳ lệnh nào xóa dữ liệu.
10. Không tự chạy `prisma db push` hay `prisma migrate`. Đổi schema thì sửa `prisma/schema.prisma` và viết lệnh SQL tương ứng vào `docs/sql/` (tên file: `YYYY-MM-DD-Bx-mo-ta.sql`), ghi vào Bàn giao để Tuấn tự chạy.
11. Không sửa `.env`, không commit mật khẩu hay API key.
