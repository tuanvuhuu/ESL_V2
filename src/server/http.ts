import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { Viewer } from "@/lib/permissions";
import { getViewer, runAsActor } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const notFound = (what = "Không tìm thấy dữ liệu") => new HttpError(404, what);
export const unauthorized = () => new HttpError(401, "Phiên đăng nhập đã hết, đăng nhập lại để tiếp tục");
export const forbidden = (message = "Tài khoản của bạn không có quyền làm việc này") => new HttpError(403, message);
/** Chặn nếu điều kiện quyền không đạt. */
export function allow(ok: boolean, message?: string): asserts ok {
  if (!ok) throw forbidden(message);
}
/** Bị chặn theo quy tắc nghiệp vụ (trùng phòng, trùng người dạy…). */
export const conflict = (message: string, details?: unknown) => new HttpError(409, message, details);

type Handler<C> = (req: Request, ctx: C, viewer: Viewer) => Promise<unknown>;
type PublicHandler<C> = (req: Request, ctx: C) => Promise<unknown>;

/** Bọc route handler: bắt buộc đăng nhập, trả JSON, đổi lỗi thành thông báo tiếng Việt. */
export function route<C = unknown>(fn: Handler<C>) {
  return publicRoute<C>(async (req, ctx) => {
    const viewer = await getViewer(req);
    if (!viewer) throw unauthorized();
    return runAsActor(viewer.fullName, () => fn(req, ctx, viewer));
  });
}

/** Như `route` nhưng không cần đăng nhập (đăng nhập, tạo tài khoản đầu tiên). */
export function publicRoute<C = unknown>(fn: PublicHandler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const data = await fn(req, ctx);
      if (data instanceof Response) return data;
      return NextResponse.json(data ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return NextResponse.json(
          { error: first?.message ?? "Dữ liệu không hợp lệ", details: err.issues },
          { status: 400 },
        );
      }
      console.error(err);
      return NextResponse.json({ error: "Có lỗi xảy ra, thử lại sau." }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const json = await req.json().catch(() => {
    throw badRequest("Dữ liệu gửi lên không đúng định dạng");
  });
  return schema.parse(json);
}

export function idParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

export type IdCtx = { params: Promise<{ id: string }> };
