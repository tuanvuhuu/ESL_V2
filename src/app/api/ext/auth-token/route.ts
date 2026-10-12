import { NextResponse } from "next/server";

/**
 * Endpoint dự phòng hỗ trợ extension trình duyệt (browser extension/proxy)
 * tránh báo lỗi 404 trong Console khi extension tự động thăm dò token.
 */
export async function GET() {
  return NextResponse.json({ authenticated: false, token: null });
}

export async function POST() {
  return NextResponse.json({ authenticated: false, token: null });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
