import { Banknote, CalendarCheck, GraduationCap, Languages, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import { EUROPE_EXPLORER_FLAGS } from "@/components/graphics/EuropeExplorerFlags";

/**
 * UX10-EU01 — the reference's "Explore top European study destinations"
 * country-card grid (section 2). 3-column desktop / 2-column tablet /
 * 1-column mobile, per the brief's explicit responsive requirement (never
 * a simple shrink of the desktop grid).
 *
 * Germany is the one card with stronger treatment ("Recommended First"
 * badge + accent border) — per the brief, positioned as the best
 * STARTING POINT for most students (lower/no tuition at many public
 * universities + a wide, growing range of English-taught programmes),
 * never framed as a guaranteed best country for every student. Every
 * other country renders with identical visual weight.
 *
 * Each card's CTA is a same-page anchor to its matching Official Sources
 * card below (`#${country.slug}`, section 5) — Option A from the brief's
 * own country-detail-behavior menu ("on-page country detail... page
 * scrolls/updates to trusted sources"), the simplest, safest, launch-
 * ready architecture: no new dynamic routes, no 6 detail pages to build
 * and maintain, no Supabase dependency. See UX10-EU01_REFERENCE_AUDIT.md
 * section 6 for the full reasoning.
 */
export function EuropeCountryCards() {
  return (
    <div id="europe-countries" className="scroll-mt-24">
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {EUROPE_COUNTRIES.map((country) => {
          const Flag = EUROPE_EXPLORER_FLAGS[country.code];
          const points = [
            { icon: Banknote, label: country.tuitionProfile },
            { icon: Languages, label: country.englishAvailability },
            { icon: CalendarCheck, label: country.admissionProfile },
            { icon: GraduationCap, label: country.postStudyProfile },
          ];

          return (
            <li key={country.code}>
              <Card
                className={
                  country.recommended
                    ? "flex h-full flex-col rounded-[20px] border-2 border-primary shadow-[0_14px_34px_-16px_rgba(37,99,235,0.35)]"
                    : "flex h-full flex-col rounded-[20px] border border-border/80"
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-alt">
                    <Flag aria-hidden="true" className="h-11 w-11" />
                  </span>
                  {country.recommended ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
                      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                      Recommended First
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-4 text-xl font-bold text-text">{country.name}</h3>

                <ul className="mt-4 flex-1 space-y-2.5">
                  {points.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-start gap-2 text-sm leading-relaxed text-text-soft">
                      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      {label}
                    </li>
                  ))}
                </ul>

                <LinkButton
                  href={`#${country.slug}`}
                  variant={country.recommended ? "primary" : "outline"}
                  size="lg"
                  className="mt-6 w-full justify-center font-semibold"
                >
                  Explore {country.name}
                </LinkButton>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
