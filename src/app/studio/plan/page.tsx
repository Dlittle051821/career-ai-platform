import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { v54Grotesk } from "@/components/sections/home/v54/fonts";
import { MyPlanCards, PlanDocuments, PlanPendingBanner, ServiceList } from "@/components/payment-v1/MyPlan";
import { getMyPlanOverview } from "@/lib/payments/upi/my-plan";
import "@/styles/payment-v1.css";

export const metadata: Metadata = { title: "My Plan & Services", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** NW-PAYMENT-V1 — My Plan & Services in Student Studio: the purchased package, its coverage, services and documents. */
export default async function StudioPlanPage() {
  const plan = await getMyPlanOverview();
  return (
    <div className={`nwp-plan ${v54Grotesk.variable}`}>
      <div className="nws-page">
        <h1 className="nws-h1">My Plan &amp; Services</h1>
        <p className="nws-lede">Your Nextwise plan, payments and services in one place.</p>
        {plan ? <PlanPendingBanner plan={plan} /> : null}
        <h2 className="nws-h2">My plan</h2>
        <MyPlanCards plan={plan} />
        {plan ? (
          <>
            <section className="nws-card nws-services-preview" aria-labelledby="nws-svc-title">
              <div className="nws-row">
                <div>
                  <h2 id="nws-svc-title" className="nws-h2 nws-h2-in">
                    My services
                  </h2>
                  <p className="nws-sub">{plan.status === "active" ? "Unlocked with your plan." : "Unlock after your payment is confirmed."}</p>
                </div>
              </div>
              <ServiceList plan={plan} />
            </section>
            <section className="nws-card nws-services-preview" aria-labelledby="nws-docs-title">
              <h2 id="nws-docs-title" className="nws-h2 nws-h2-in">
                Documents &amp; Payments
              </h2>
              <PlanDocuments plan={plan} />
              <p className="nws-sub" style={{ marginTop: 12 }}>
                <Link className="nws-link" href="/payments">
                  All invoices and payments <ArrowRight aria-hidden="true" />
                </Link>
              </p>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
