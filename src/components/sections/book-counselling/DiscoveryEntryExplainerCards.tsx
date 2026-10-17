import { Compass, MapPinned, Target } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { FADE_UP_CLASSES, getStaggerDelayMs } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

/**
 * UX10-DS02 — the compact, explanatory-only 3-card section from the
 * reference's public landing ("Understand your goals" / "Explore India
 * and Europe options" / "Get clear next steps"). Deliberately makes no
 * claim of a guaranteed recommendation, guaranteed admission, visa
 * success, or instant matching — see this milestone's non-negotiable
 * rules and UX10-DS02_REFERENCE_AUDIT.md section 2.
 */
const CARDS = [
  {
    icon: Compass,
    title: "Understand your goals",
    description: "We start by listening — your interests, strengths and what success looks like to you.",
  },
  {
    icon: MapPinned,
    title: "Explore India and Europe options",
    description: "Talk through courses, universities and pathways across both, side by side.",
  },
  {
    icon: Target,
    title: "Get clear next steps",
    description: "Leave with a clearer sense of direction — no pressure to decide anything on the spot.",
  },
];

export function DiscoveryEntryExplainerCards() {
  return (
    <section className="bg-surface-alt py-12 sm:py-14">
      <Container>
        <div className="grid gap-5 sm:grid-cols-3">
          {CARDS.map(({ icon: Icon, title, description }, index) => (
            <Card
              key={title}
              className={cn(FADE_UP_CLASSES, "text-center")}
              style={{ transitionDelay: `${getStaggerDelayMs(index)}ms` }}
            >
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="mt-4 text-base font-semibold text-primary">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-text-soft">{description}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
