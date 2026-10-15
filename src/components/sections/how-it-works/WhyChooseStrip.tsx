import { Compass, Globe2, LifeBuoy, UserCheck, type LucideIcon } from "lucide-react";

/**
 * UX10-HW01 — the reference image's "Why Students & Parents Choose
 * Nextwise" trust/value strip (annotation #4). Same card treatment as
 * `PricingTrustStrip.tsx` (icon badge + title + one-line description, no
 * fabricated statistics) reused here for visual-family consistency rather
 * than a new strip pattern.
 */
interface StripItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

const ITEMS: StripItem[] = [
  {
    icon: Compass,
    title: "Guidance at every step",
    description: "From exploring options to starting your next chapter, you're never figuring it out alone.",
  },
  {
    icon: UserCheck,
    title: "Personalised support",
    description: "Recommendations and plans built around your own profile, not a generic checklist.",
  },
  {
    icon: Globe2,
    title: "India and global options",
    description: "Honest comparisons across India and international pathways, including our early Europe focus.",
  },
  {
    icon: LifeBuoy,
    title: "Ongoing mentorship",
    description: "Support continues after admission — through visa prep, pre-departure planning and beyond.",
  },
];

export function WhyChooseStrip() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {ITEMS.map(({ icon: Icon, title, description }) => (
        <div
          key={title}
          className="rounded-2xl border border-border/80 bg-surface px-5 py-6 text-center shadow-[0_6px_18px_-10px_rgba(15,23,42,0.18)]"
        >
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm font-semibold text-text">{title}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
        </div>
      ))}
    </div>
  );
}
