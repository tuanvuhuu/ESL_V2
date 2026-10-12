import { canSeeFinance } from "@/lib/permissions";
import { CreatePaymentInput, createPayment, listPayments } from "@/server/finance";
import { allow, body, route } from "@/server/http";

export const GET = route(async (req, _ctx, viewer) => {
  allow(canSeeFinance(viewer), "Không có quyền xem phiếu thu");
  const sp = new URL(req.url).searchParams;
  const centerId = Number(sp.get("centerId")) || undefined;
  const studentId = Number(sp.get("studentId")) || undefined;
  const enrollmentId = Number(sp.get("enrollmentId")) || undefined;
  const fromDate = sp.get("fromDate") || undefined;
  const toDate = sp.get("toDate") || undefined;
  const status = sp.get("status") || undefined;

  return listPayments({ centerId, studentId, enrollmentId, fromDate, toDate, status });
});

export const POST = route(async (req, _ctx, viewer) => {
  const input = await body(req, CreatePaymentInput);
  return createPayment(input, viewer);
});
