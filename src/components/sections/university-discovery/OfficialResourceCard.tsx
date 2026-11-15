import type { CSSProperties } from "react";
import { ExternalLink } from "lucide-react";
import type { AdapterResult } from "@/lib/education/external-search/provider-types";
import { getOfficialResourceCopy } from "@/lib/education/university-discovery/destinations";
import { getLaunchCountryPrimarySource } from "@/lib/education/external-search/launch-country-sources";
import { isLaunchPrimaryResult } from "@/lib/education/external-search/launch-primary-result";

/**
 * V3 official-resource card. The outbound link never points at `result.url`
 * directly: it goes through the existing /go/course-search redirect, which
 * re-validates the destination against the provider's official domain on the
 * server and records the click (same rule as TrustedExternalSearchCard).
 */
export function OfficialResourceCard({ result, index }: { result: AdapterResult; index: number }) {
  const goHref = result.isFiltered && result.mappingId ? `/go/course-search/${result.mappingId}` : `/go/course-search/provider/${result.providerId}`;
  const copy = getOfficialResourceCopy(result.officialDomain);
  const primary = isLaunchPrimaryResult(result, result.countryCode) ? getLaunchCountryPrimarySource(result.countryCode) : null;
  const summary = copy?.summary ?? primary?.purpose ?? null;
  const headingId = `ud-resource-${result.providerId}`;
  return (
    <li className="ud-res" style={{ "--i": index } as CSSProperties}>
      <div className="ud-res-top">
        <span className="ud-res-mark" aria-hidden="true">{result.providerDisplayName.split(/\s[—–-]\s/)[0]}</span>
        <span className="ud-tag">{copy?.category ?? "Official source"}</span>
      </div>
      <h3 id={headingId}>{result.providerDisplayName}</h3>
      {summary ? <p>{summary}</p> : null}
      {result.warningText ? <p className="ud-res-warn">{result.warningText}</p> : null}
      <div className="ud-res-foot">
        <span className="ud-res-domain">{result.officialDomain}</span>
        <a href={goHref} target="_blank" rel="noopener noreferrer" className="ud-btn" data-variant="navy" aria-describedby={headingId}>
          Visit {result.providerDisplayName.split(/\s[—–-]\s/)[0]}
          <ExternalLink aria-hidden="true" />
          <span className="sr-only"> (official external website, opens in a new tab)</span>
        </a>
      </div>
    </li>
  );
}
