import Link from "next/link";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { DISCOVERY_SESSION_CTA } from "@/config/site";
import type { CareerCardExtras } from "@/lib/supabase/career-explorer";
import type { CareerSummary } from "@/types/career";
import { CareerExplorerCard } from "./CareerExplorerCard";
import { HeroN } from "./HeroN";

/**
 * Career Explorer V5 hero — "Explore careers. Discover what's possible."
 * Left: headline, description, the search (a plain GET form to /careers, so
 * it works without scripts) and the two actions. Right: three real career
 * cards and the Nextwise N in its resting place.
 */
export function CareerExplorerHero({
  total,
  featured,
  extras,
  savedIds,
}: {
  total: number;
  featured: CareerSummary[];
  extras: Map<string, CareerCardExtras>;
  savedIds: Set<string>;
}) {
  const [first, ...rest] = featured;
  return (
    <section className="ce-hero" aria-labelledby="ce-hero-title">
      <div className="ce-wrap ce-hero-grid">
        <div>
          <p className="ce-hero-top">
            <span className="ce-eyebrow">Career Explorer</span>
            <span className="ce-pill">Free to browse</span>
          </p>
          <h1 id="ce-hero-title">
            Explore careers.
            <br />
            Discover what&rsquo;s possible.
          </h1>
          <p className="ce-hero-lede">
            Browse career paths across different industries, understand what they involve, and discover opportunities that match your
            ambitions.
          </p>
          <form className="ce-search" role="search" method="get" action="/careers">
            <Search aria-hidden="true" />
            <input
              type="search"
              name="q"
              aria-label="Search careers"
              placeholder={total > 0 ? `Search ${total} careers by title` : "Search careers by title"}
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit" aria-label="Search careers">
              <ArrowRight aria-hidden="true" />
            </button>
          </form>
          <div className="ce-hero-actions">
            <Link href="#all-careers" className="ce-btn" data-variant="primary">
              Explore All Careers
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link href={DISCOVERY_SESSION_CTA.href} className="ce-btn" data-variant="outline">
              Book a Free Discovery Session
            </Link>
          </div>
          <p className="ce-hero-ci">
            <Sparkles aria-hidden="true" />
            Want guidance tailored to you?
            <Link href="/career/access" className="ce-textlink">
              Discover Career Intelligence
              <ArrowRight aria-hidden="true" />
            </Link>
          </p>
        </div>
        <div className="ce-hero-art">
          <HeroN />
          {first ? (
            <div className="ce-hero-col" data-lead="">
              <CareerExplorerCard career={first} extras={extras.get(first.id)} saved={savedIds.has(first.id)} sizes="(max-width: 640px) 100vw, 290px" priority />
            </div>
          ) : null}
          {rest.length > 0 ? (
            <div className="ce-hero-col">
              {rest.map((career) => (
                <CareerExplorerCard key={career.id} career={career} extras={extras.get(career.id)} saved={savedIds.has(career.id)} sizes="290px" />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
