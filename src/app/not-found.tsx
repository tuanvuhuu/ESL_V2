import Link from "next/link";
import { Button, Result } from "@/client/primer-compat";

export default function NotFound() {
  return (
    <div style={{ minHeight: "80vh", display: "grid", placeItems: "center", padding: 24 }}>
      <Result
        status="404"
        title="404 - Không tìm thấy trang"
        subTitle="Đường dẫn bạn yêu cầu không tồn tại hoặc đã được chuyển sang địa chỉ khác."
        extra={
          <Link href="/">
            <Button type="primary">Về trang chủ</Button>
          </Link>
        }
      />
    </div>
  );
}
