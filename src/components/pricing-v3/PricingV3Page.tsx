import { CTASection } from "@/components/sections/CTASection";
import { v54Grotesk } from "@/components/sections/home/v54/fonts";
import type { V3PublicPlan } from "@/lib/pricing/v3/catalogue";
import { V3_STAGE } from "@/lib/pricing/v3/content";
import type { V3PlanSlug } from "@/lib/pricing/v3/quote";
import { PricingV3 } from "./PricingV3";
import "@/styles/pricing-v3.css";

/** NW-PRICING-V3 page: the hero (server-rendered) and the interactive packages. */
export function PricingV3Page(props: { plans: V3PublicPlan[]; signedIn: boolean; purchasesOpen: boolean; initialPlan: V3PlanSlug | null; initialExtra: number }) {
  return (
    <>
      <div className={`pv3 ${v54Grotesk.variable}`}>
        <section className="pv3-hero on-navy" aria-labelledby="pv3-title">
          <div className="wrap">
            <h1 id="pv3-title" className="display">
              The right guidance. At the right stage.
            </h1>
            <p className="lede">From understanding your career direction to navigating your study-abroad journey, choose the support that matches your next step.</p>
            <ol className="pv3-stages" aria-label="Three stages, three packages">
              {props.plans.map((p, i) => (
                <li key={p.slug} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                  <span className="n">{i + 1}</span>
                  <span>
                    <b>{V3_STAGE[p.slug].stage}</b>
                    <span>{p.name}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <PricingV3 {...props} />
      </div>
      <CTASection />
    </>
  );
}
