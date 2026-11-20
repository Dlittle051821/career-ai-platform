import { redirect } from "next/navigation";
import { quotePackage } from "@/app/(site)/pricing/actions";
import { isUpiCheckoutOpen } from "@/lib/payments/upi/config";
import { createClient } from "@/lib/supabase/server";
import { isV3PlanSlug, parseAdditionalUniversities, V3_PLAN_SLUGS } from "@/lib/pricing/v3/quote";

export const dynamic = "force-dynamic";

/**
 * NW-PAYMENT-V1 — entry from the Pricing summary ("Continue to secure
 * checkout"). The selection travels only as a plan slug and a whole number of
 * additional universities; the server prices it again from the published
 * catalogue and the database stores it as the student's quote. Signed-out
 * visitors go to the Account step and come straight back here afterwards,
 * so the selection is never lost.
 */
export default async function CheckoutStartPage({ searchParams }: { searchParams: Promise<{ plan?: string; extra?: string }> }) {
  const { plan, extra } = await searchParams;
  if (!isV3PlanSlug(plan)) redirect("/pricing");
  const additional = plan === V3_PLAN_SLUGS.verified ? 0 : (parseAdditionalUniversities(extra ?? "0") ?? 0);
  const pricingHref = `/pricing?plan=${plan}${additional ? `&extra=${additional}` : ""}`;
  if (!isUpiCheckoutOpen()) redirect(pricingHref);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const self = `/checkout/start?plan=${plan}${additional ? `&extra=${additional}` : ""}`;
  if (!user) redirect(`/checkout/account?next=${encodeURIComponent(self)}`);

  // Reuse the student's current open quote for exactly this package (a double render or a back-and-forth
  // must not create a second quote, which would supersede the first one mid-checkout).
  const { data: existing } = await supabase
    .from("pricing_quotes")
    .select("id")
    .eq("student_user_id", user.id)
    .eq("status", "open")
    .eq("plan_slug_at_quote", plan)
    .eq("additional_universities", additional)
    .gt("expires_at", new Date(Date.now() + 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) redirect(`/checkout/${existing.id}`);

  const result = await quotePackage(plan, additional, true);
  if (result.status !== "ok" || result.saved !== "account" || !result.quoteId) redirect(pricingHref);
  redirect(`/checkout/${result.quoteId}`);
}
