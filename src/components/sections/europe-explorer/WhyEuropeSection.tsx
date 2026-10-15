import { Banknote, Briefcase, GraduationCap, Users } from "lucide-react";

/**
 * UX10-EU01 — the reference's "A smart choice for your future" value-card
 * section (section 3). Every claim is deliberately hedged per the brief's
 * own instruction ("Do NOT claim Europe is universally cheaper... keep
 * claims conservative and defensible") — no blanket statements, no
 * fabricated statistics.
 */
const VALUES = [
  {
    icon: GraduationCap,
    title: "High-quality education",
    description: "Many European universities are globally recognised, with strong teaching and research across a wide range of fields.",
  },
  {
    icon: Banknote,
    title: "More affordable options",
    description: "Many European destinations offer lower or no tuition at public universities compared to common English-speaking alternatives — though costs vary significantly by country.",
  },
  {
    icon: Briefcase,
    title: "Real career opportunities",
    description: "Several countries offer structured post-study work options, helping graduates build genuine international career experience.",
  },
  {
    icon: Users,
    title: "Diverse and welcoming",
    description: "A growing number of English-taught programmes and large, established international student communities across the region.",
  },
];

export function WhyEuropeSection() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {VALUES.map(({ icon: Icon, title, description }) => (
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
