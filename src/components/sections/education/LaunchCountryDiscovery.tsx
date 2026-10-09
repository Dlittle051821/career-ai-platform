import Link from "next/link";
import { Globe2 } from "lucide-react";
import { LAUNCH_COUNTRY_CODES, LAUNCH_COUNTRY_NAMES, type LaunchCountryCode } from "@/lib/education/external-search/launch-countries";
import { cn } from "@/lib/utils";

interface LaunchCountryDiscoveryProps {
  /**
   * The launch country the page's OWN existing query state currently
   * resolves to — null when no destination is selected, or the current
   * selection is a valid but non-launch-country value (e.g. a country this
   * dataset supports that isn't one of the six Tier 1 launch countries).
   * Each page computes this itself from state it already has
   * (`/courses`'s `destination` param, `/universities`'s single-selected
   * country checkbox) via M20A's own `isLaunchCountryCode` — this
   * component never re-derives or re-parses anything from raw query
   * params itself.
   */
  selectedCode: LaunchCountryCode | null;
  /**
   * Builds the href for selecting (or, for `null`, clearing) a launch
   * country, while preserving every OTHER filter/query param already
   * active on the calling page. Each page already owns its own
   * filter-to-querystring logic (`/courses`'s `destination` param,
   * `/universities`'s `country` checkbox param) — this component
   * deliberately never constructs a query string itself, so it stays a
   * pure presentation layer with zero page-specific param knowledge and
   * zero duplicated "which param name does this page use" logic.
   */
  buildHref: (code: LaunchCountryCode | null) => string;
  /**
   * Launch countries this page cannot currently link to (e.g. `/universities`
   * found no active `public.countries` row for that ISO code). Rendered as
   * a disabled, non-clickable chip with a short honest note instead of a
   * silently-broken or silently-ignored link — never hidden outright, so
   * the six-launch-country set always reads as complete.
   */
  unavailableCodes?: readonly LaunchCountryCode[];
  className?: string;
}

/**
 * M20C — the one reusable "explore a launch country" quick-select strip,
 * shared by `/courses` and `/universities`. Deliberately NOT a second
 * hardcoded country list: every code/name it renders comes from M20A's
 * `LAUNCH_COUNTRY_CODES`/`LAUNCH_COUNTRY_NAMES` (the single source of
 * truth — see launch-countries.ts), and it carries no knowledge of
 * `getTrustedSearchResults`, the provider registry, or either page's own
 * filter scheme. A plain, keyboard-and-screen-reader-accessible set of
 * real `<Link>` navigations (works with JavaScript disabled, every
 * selection is a shareable URL) — never a client-side toggle, so it needs
 * no "use client" boundary and composes with every existing GET-form filter
 * on either page without any state-synchronization code.
 *
 * Deliberately subtle: a labeled `<nav>` of small pill links, not a bank of
 * marketing cards — the six launch countries are a quick way to jump
 * straight to a trusted official source, not a promotional unit.
 */
export function LaunchCountryDiscovery({ selectedCode, buildHref, unavailableCodes = [], className }: LaunchCountryDiscoveryProps) {
  return (
    <nav aria-label="Explore a launch country's trusted official source" className={cn("w-full", className)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary-dark">
        <Globe2 aria-hidden="true" className="h-3.5 w-3.5" />
        Explore a launch country
      </p>
      <ul className="flex flex-wrap gap-2" role="list">
        <li>
          <Link
            href={buildHref(null)}
            aria-current={selectedCode === null ? "true" : undefined}
            className={cn(
              "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
              selectedCode === null
                ? "border-secondary bg-secondary text-white"
                : "border-border-strong bg-surface text-text-soft hover:bg-surface-alt"
            )}
          >
            All countries
          </Link>
        </li>
        {LAUNCH_COUNTRY_CODES.map((code) => {
          const isSelected = selectedCode === code;
          const isUnavailable = unavailableCodes.includes(code);
          if (isUnavailable) {
            return (
              <li key={code}>
                <span
                  aria-disabled="true"
                  title={`${LAUNCH_COUNTRY_NAMES[code]} is not available to select here yet`}
                  className="inline-flex cursor-not-allowed items-center rounded-full border border-border-strong bg-surface-alt px-3.5 py-1.5 text-sm font-medium text-muted opacity-60"
                >
                  {LAUNCH_COUNTRY_NAMES[code]}
                </span>
              </li>
            );
          }
          return (
            <li key={code}>
              <Link
                href={buildHref(code)}
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
                  isSelected
                    ? "border-secondary bg-secondary text-white"
                    : "border-border-strong bg-surface text-text-soft hover:bg-surface-alt"
                )}
              >
                {LAUNCH_COUNTRY_NAMES[code]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
