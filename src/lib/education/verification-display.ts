/**
 * CC-22B — how a university or course record's verification state is shown
 * to students. Published-but-unverified records stay visible for
 * exploration, but they are never presented as checked:
 *
 *   - the badge says "Not yet verified" instead of a green freshness label
 *     (the freshness band is computed from last_verified_at alone, which
 *     does not mean a person has verified the record);
 *   - rankings are hidden and scholarship claims are qualified until the
 *     record is verified;
 *   - students are pointed to the official institution page.
 *
 * Display only — nothing here changes a record's stored status.
 */
export const NOT_YET_VERIFIED_LABEL = "Not yet verified";

export const UNVERIFIED_RECORD_NOTE =
  "Nextwise hasn't verified this record yet. Always confirm courses, fees, deadlines and requirements on the official university website before you decide or apply.";

export const UNVERIFIED_SCHOLARSHIP_NOTE =
  "Scholarship details here are not yet verified by Nextwise — confirm eligibility, amounts and deadlines with the university.";

export function isVerifiedEducationRecord(status: string | null | undefined): boolean {
  return status === "verified";
}

/** Rankings are a factual claim with no provenance shown, so they appear only for verified records. */
export function shouldShowRankings(status: string | null | undefined): boolean {
  return isVerifiedEducationRecord(status);
}

/** "Last verified" only makes sense for a verified record; otherwise the date is just the last data update. */
export function lastCheckedLabel(status: string | null | undefined): string {
  return isVerifiedEducationRecord(status) ? "Last verified" : "Last data update";
}
