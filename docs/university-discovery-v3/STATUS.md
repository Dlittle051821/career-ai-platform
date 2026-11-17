# University Discovery V3 — status

Branch `feature/university-discovery-v3-approved`, based on live production `acf9dff`. Design reference:
`Nextwise_University_Discovery_Concept_V3.mp4`. **Nothing has been pushed, deployed, or applied to any hosted
database. Production is unchanged.** The branch is ready for a Vercel Preview and the owner's visual review.

## What is in the branch

| Area | State |
|---|---|
| Access tiers | anonymous, free, payment pending, payment failed, Verified (paid), Verified (granted by admin), staff. Decided on the server; fail-closed. |
| `/universities` free | Six destinations, official portals from the trusted-source registry, Verified panel, free session. No directory query runs. |
| `/universities` Verified | Photo-led cards (credit on every photograph, placeholder when there is none), category, public/private, location, study areas, sourced highlight, verification line. Filters: search, country, state/region, city, institution type, public/private, study area, sort. Server-side pagination, empty/error/loading states. |
| `/universities/[slug]` | Hero photograph with credit, overview, facts, campus gallery, sourced highlights, focus areas, rankings (provider, year, subject vs overall, source), next steps, sticky actions (save, official website, guidance). Locked preview without access; no record is fetched for it. |
| Verified dialog | Eight states: anonymous, free, payment pending, payment failed, Verified, granted by admin, session expired, network/server error (with retry). Price ₹1,999 from the catalogue; purchase action disabled. |
| Admin grant | Student page → "Verified university access" card: grant with reason and optional expiry, revoke with reason, history. Only super_admin/admin. Written through audited database functions; nobody can write the table directly. |
| Saved universities | `/saved` (Universities tab) and a panel in `/studio`: thumbnail, details, quick access, remove, empty state, locked state that keeps the shortlist when access ends. |
| Course Explorer | Official portals for every student account. Old course URLs and comparison redirect to `/courses` with an explanation. Saved courses keep their title and an official link; existing applications are untouched. |
| Trusted portals | Managed in Admin → Education → Sources (list, add, "I checked this address", show/hide). Hochschulkompass and Study in Germany are in a proposed seed, inserted switched off. |
| Database | Three proposed migrations with rollbacks in `supabase/migrations-proposed/UNI_V3/`. See TEST-REPORT.md. |
| Germany data | 239 public institutions prepared for review (`germany-import/`). See GERMANY-IMPORT-AUDIT.md. |

## Order of dependence

The application code works against today's database: without migration 0002 the category and study-area filters
hide themselves and photographs are not shown; without 0001 the admin grant card reports that it is not available.
The database-level protection exists only after 0001 is applied.

## Decisions still needed from the owner

1. **Applying from a course page.** Students could start an application from an internal course page. Those pages are
   now staff-only, so a student cannot start a new application by themselves; a counsellor/admin still can. Keep it
   that way, or add a different student entry point?
2. **Compare universities.** There was no university comparison before V3 and none was added; the profile offers
   "Review your shortlist" instead.
3. **GST-inclusive checkout.** Purchase stays off. The existing proposal `NW01_fix_purchase_pricing_plan_tax_handling.sql`
   is untouched and needs its own review before the ₹1,999 purchase is enabled.
4. **TU Berlin photograph** has licence status "pending review" (Commons "copyrighted free use"); it is stored but not
   shown to students until someone clears it.
5. **Publishing.** All 239 Germany records import as drafts marked "needs review". Publishing is a separate admin step.
