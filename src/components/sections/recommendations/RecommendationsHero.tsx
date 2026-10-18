/**
 * UX10-REC01 — the recommendations workspace's greeting hero, matching the
 * reference mockup's "Hi {name} 👋 / Here are your personalised
 * recommendations" intent (brief section 5) as closely as this codebase's
 * own real dashboard-shell hero convention allows.
 *
 * Name: `firstNameFrom()`'s real-name-or-"there" fallback
 * (`src/lib/supabase/profile.ts`) — brief section 5 is explicit that a
 * name must never be required just to render the page, so "there" renders
 * a grammatically clean "Hi there 👋" rather than a blank or a fabricated
 * name.
 *
 * Visual treatment: reuses `/dashboard`'s own compact greeting-band
 * pattern (translucent `/hero/campus-sky-backdrop.png`, no new
 * illustration/stock imagery per brief section 11) rather than the larger
 * marketing-style portrait+bubble hero used on public pages like
 * `/book-counselling` — this page lives inside `DashboardShell` alongside
 * `/dashboard` and `/profile`, and brief section 29 requires REC01 to
 * visually belong to that family, not introduce a second hero language.
 *
 * Conceptual chips: the mockup shows 4 floating bubbles over an
 * illustration ("Your Interests", "Your Strengths", "Global
 * Opportunities", "Our Expert Guidance"). Per brief section 5's own
 * guidance ("derive labels from real categories only... safe conceptual
 * bubbles: Your interests / Your strengths / Study preferences / Next
 * steps"), this reuses exactly that safe label set as a compact chip row
 * instead — real profile dimension names, not a visual claim about
 * "global opportunities" or "expert guidance" this page can't back up on
 * its own, and no new illustration asset.
 */
import Image from "next/image";
import { Heart, Lightbulb, MapPinned, ListChecks } from "lucide-react";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const CONCEPTUAL_CHIPS = [
  { label: "Your interests", icon: Heart },
  { label: "Your strengths", icon: Lightbulb },
  { label: "Study preferences", icon: MapPinned },
  { label: "Next steps", icon: ListChecks },
];

export function RecommendationsHero({ firstName }: { firstName: string }) {
  return (
    <div className="relative -mx-4 -mt-6 overflow-hidden rounded-b-[1.5rem] px-4 pb-6 pt-6 sm:-mx-6 sm:px-6 lg:-mx-10 lg:-mt-8 lg:px-10 lg:pb-8 lg:pt-8">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image src="/hero/campus-sky-backdrop.png" alt="" fill priority className="object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
        {greeting()}, {firstName} <span aria-hidden="true">👋</span>
      </p>
      <h1 className="mt-1.5 font-sans text-2xl font-semibold text-text sm:text-3xl">Your personalised recommendations</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-muted sm:text-base">
        Based on your profile, interests, academic background, and career goals — plus how reliable it all is right
        now, and what to do next.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {CONCEPTUAL_CHIPS.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/90 px-3 py-1.5 text-xs font-medium text-text-soft shadow-soft backdrop-blur-sm"
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 text-secondary-dark" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
