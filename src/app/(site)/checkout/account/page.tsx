import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { quotePackage } from "@/app/(site)/pricing/actions";
import { LoginForm } from "@/components/sections/auth/LoginForm";
import { OrderSummary, SecurityNote, Steps, taxNoteFor } from "@/components/payment-v1/parts";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * NW-PAYMENT-V1 — the Account step of the approved design: sign in or create
 * an account without losing the package. `next` always points back to
 * /checkout/start with the same plan and additional universities.
 */
export default async function CheckoutAccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = getSafeRedirectPath(next, "");
  if (!safeNext.startsWith("/checkout/start?")) redirect("/pricing");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(safeNext);

  const params = new URL(safeNext, "http://local").searchParams;
  const quote = await quotePackage(params.get("plan"), params.get("extra") ?? "0", false);
  const registerHref = `/register?next=${encodeURIComponent(safeNext)}`;

  return (
    <main className="nwp-main nwp-auth" id="main-content">
      <div className="nwp-wrap">
        <Steps at={2} />
        <div className="nwp-auth-grid">
          <section className="nwp-card nwp-auth-card" aria-labelledby="nwp-auth-title">
            <h1 id="nwp-auth-title" className="nwp-h1">
              One step before you continue.
            </h1>
            <p className="nwp-lede">Sign in or create your Nextwise account to securely complete your payment and keep all your documents and services together.</p>
            <div className="nwp-login-form">
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>
            <p className="nwp-fine">
              New to Nextwise?{" "}
              <Link href={registerHref} className="nwp-link">
                Create an account
              </Link>
            </p>
          </section>
          <aside className="nwp-auth-side">
            {quote.status === "ok" ? (
              <OrderSummary
                pkg={{
                  planSlug: quote.planSlug,
                  planName: quote.planName,
                  baseMinor: quote.quote.baseAmountMinorUnits,
                  includedUniversities: quote.quote.includedUniversities,
                  additionalUniversities: quote.quote.additionalUniversities,
                  addonUnitMinor: quote.quote.addonUnitAmountMinorUnits,
                  addonMinor: quote.quote.addonAmountMinorUnits,
                  totalMinor: quote.quote.totalAmountMinorUnits,
                }}
                taxNote={taxNoteFor(quote.planSlug)}
              />
            ) : null}
            <p className="nwp-keep">Your package and additional universities stay selected after you sign in.</p>
            <SecurityNote />
          </aside>
        </div>
      </div>
    </main>
  );
}
