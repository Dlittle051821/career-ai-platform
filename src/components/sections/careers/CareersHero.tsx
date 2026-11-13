import { Globe2, Play, ShieldCheck, UserCheck } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";

/**
 * CIUX-01B — Career Explorer, first screen, on the shared PageHero (the
 * homepage's visual language). Replaces the UX10 hero (campus-photo
 * backdrop, student cut-out with annotation images, blue/orange buttons).
 * Copy and actions are unchanged in substance; the five-step journey strip
 * just below (JourneyMiniMap) still shows the explorer's path.
 */
const TRUST_CUES = [
  { icon: ShieldCheck, label: "Trusted global sources" },
  { icon: UserCheck, label: "Personalised guidance available" },
  { icon: Globe2, label: "From study to real careers" },
];

export function CareersHero() {
  return (
    <PageHero
      id="careers"
      eyebrow="Career Explorer"
      title="Explore career paths,"
      titleAccent="from interest to work."
      description="Discover what working in different fields is like, the skills you'll need, and the study paths that can take you there."
      primaryAction={{ href: "#career-results", label: "Start exploring" }}
      secondaryAction={{ href: "/how-it-works", label: "How it works", icon: <Play aria-hidden="true" /> }}
      points={TRUST_CUES}
      fadeTo="muted"
    />
  );
}
