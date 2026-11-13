import { Compass, Globe2, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";

/**
 * CIUX-01B — Pricing, first screen, on the shared PageHero (centred, the
 * homepage's visual language). Replaces the UX10-PR01B hero. The copy is
 * unchanged, including the honest payment sentence: while paid checkout is
 * off (CC-26), prices are information only and the first step is the free
 * Discovery Session. Nothing about payments is enabled here.
 */
const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Clear guidance" },
  { icon: Compass, label: "Expert support" },
  { icon: Globe2, label: "India & global opportunities" },
];

export function PricingHero({ paidCheckoutEnabled = false }: { paidCheckoutEnabled?: boolean }) {
  return (
    <PageHero
      id="pricing"
      align="center"
      eyebrow="Pricing & plans"
      title="Plans for"
      titleAccent="every journey."
      description={
        <>
          Choose the right level of support for your India and abroad study goals. A one-time payment, no subscriptions,
          no recurring charges.{" "}
          {paidCheckoutEnabled
            ? "Every price below is the full amount for that package."
            : "Prices are shown for information — online payment isn\u2019t open yet, so the first step is a free Discovery Session."}
        </>
      }
      points={TRUST_POINTS}
    />
  );
}
