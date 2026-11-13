import { Calendar, Globe2, ShieldCheck, UserCheck, Wallet } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";

/**
 * CIUX-01B — Study in Europe, first screen, on the shared PageHero (the
 * homepage's visual language). Replaces the UX10 hero (campus-photo
 * backdrop, student cut-out, blue/orange buttons). Copy and actions are
 * unchanged in substance.
 */
const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Trusted official sources" },
  { icon: UserCheck, label: "Realistic guidance for your profile" },
  { icon: Wallet, label: "Focus on affordable quality education" },
  { icon: Globe2, label: "Support from experts when you need it" },
];

export function EuropeExplorerHero() {
  return (
    <PageHero
      id="study-europe"
      eyebrow="Study in Europe"
      title="Explore Europe"
      titleAccent="with confidence."
      description="Compare study destinations, understand costs and requirements, and use trusted official sources before making a decision."
      primaryAction={{ href: "#europe-countries", label: "Explore countries" }}
      secondaryAction={{ href: "/book-counselling", label: "Talk to an expert", icon: <Calendar aria-hidden="true" /> }}
      points={TRUST_POINTS}
    />
  );
}
