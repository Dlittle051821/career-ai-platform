import { CTASection } from "@/components/sections/CTASection";
import { v54Grotesk } from "@/components/sections/home/v54/fonts";
import type { V3PublicPlan } from "@/lib/pricing/v3/catalogue";
import type { V3PlanSlug } from "@/lib/pricing/v3/quote";
import { PricingV3 } from "./PricingV3";
import "@/styles/pricing-v3.css";

/**
 * NW-PRICING-V3.1 page. No introductory hero: the three packages and their prices start
 * directly under the site navigation. The page heading is for screen readers only.
 */
export function PricingV3Page(props: { plans: V3PublicPlan[]; signedIn: boolean; purchasesOpen: boolean; upiCheckoutOpen?: boolean; initialPlan: V3PlanSlug | null; initialExtra: number }) {
  return (
    <>
      <div className={`pv3 ${v54Grotesk.variable}`}>
        <h1 className="sr">Nextwise plans and pricing</h1>
        <PricingV3 {...props} />
      </div>
      <CTASection />
    </>
  );
}
