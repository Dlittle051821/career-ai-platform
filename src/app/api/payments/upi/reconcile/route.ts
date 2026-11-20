import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { reconcileOpenAttempts } from "@/lib/payments/upi/checkout-service";
import { isUpiCheckoutOpen } from "@/lib/payments/upi/config";

/**
 * NW-PAYMENT-V1 — scheduled reconciliation. Asks Razorpay about every open or
 * recently closed UPI checkout and settles anything it reports as paid. This
 * is the safety net for a payment whose webhook was lost while the student
 * had already closed the browser. Run it every few minutes (Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`).
 *
 * The route holds no user session and no service-role key: the database
 * functions it calls accept only records signed with the Razorpay key secret.
 */
export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: Request): Promise<NextResponse> {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (!isUpiCheckoutOpen()) return NextResponse.json({ skipped: "UPI checkout is not open." });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const db = createSupabaseClient<Database>(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const result = await reconcileOpenAttempts(db);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[payments/upi/reconcile] failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Reconciliation failed." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
