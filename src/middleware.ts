import { NextResponse, type NextRequest } from "next/server";

// Chưa có cookie phiên thì chuyển về trang đăng nhập. Kiểm tra phiên thật và quyền nằm ở từng API.
export function middleware(req: NextRequest) {
  if (req.cookies.has("esl_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|login|_next|favicon.ico|.*\\.(?:png|jpg|svg|ico|webmanifest)$).*)"],
};
