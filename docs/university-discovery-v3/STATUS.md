# University Discovery V3 — implementation status

Design reference: `Nextwise_University_Discovery_Concept_V3.mp4` (approved).
Branch: `feature/university-discovery-v3-approved`, based on live production `acf9dff` (`hotfix/v5631-auth`,
which contains the UI baseline tag `nextwise-ui-v563-approved`).

**This branch is increment 1 of the V3 implementation. It is not the complete V3 release and must not be
promoted to production as "University Discovery V3". Nothing was pushed, deployed or applied to any database.**

## Done in increment 1 (built, tested locally)

| Area | What works |
|---|---|
| Access tiers | `anonymous`, `signed_in_free`, `payment_pending`, `verified`, `admin`, decided on the server from the session, `admin_roles` and the live invoice status of a `nextwise-verified` / `nextwise-essential` purchase. Fail-closed. |
| `/universities` (free) | Six destination cards (flag, approved photograph, name, descriptor) from the approved Europe configuration; selected country shows official portals from the trusted-source registry through the validated `/go/course-search` redirect; guidance; Verified panel; free discovery session. No directory query runs. |
| Verified dialog | The one approved visual improvement: split panel, three benefits, and a right panel driven by the real account state (anonymous, signed in not Verified, payment pending, Verified). Native `<dialog>`: focus trap, Escape, focus return, reduced motion, mobile layout. No timed or fake status badges. |
| `/universities/[slug]` | Without directory access: no record lookup, locked preview with upgrade path and official resources. |
| `/courses`, course detail, course comparison | Every student account (including Verified) gets country selection and official public portals. Detail and comparison redirect to `/courses` before any programme lookup. Staff keep the existing pages. |
| Data layer | Every reader in `src/lib/supabase/education/universities.ts` and `courses.ts` checks access first, so saved items, dashboard, recommendations, Studio and the sitemap cannot read past the rule. |
| Price | ₹1,999 from the approved catalogue. No ₹199 plan. Purchase action follows the existing paid-checkout switch, which is off. |

## Not done yet (increment 2 and later)

1. **V3 paid directory visuals**: photo-led university cards, filter bar restyle, saved-count strip. Verified users currently see the existing directory layout behind the gate.
2. **V3 university profile**: hero photograph, campus gallery, "What makes this university stand out?", academic strengths, rankings, sticky actions.
3. **Student-safe enrichment data**: no table yet for highlights, subject strengths, rankings, photographs and credits, or the official course-catalogue URL. Needs a schema proposal.
4. **Germany institution import for review**: not prepared yet.
5. **Saved universities in the dashboard** in the V3 design (the existing `/saved` page still works for users with access).
6. **Database enforcement**: `supabase/migrations-proposed/UNI_V3/0001_university_directory_access.sql` is written but has not been run against any database. Until it is reviewed and applied, published university and course rows remain readable through the REST API with the publishable key, exactly as before this branch.
7. **Verified purchase**: stays off. The GST-inclusive ₹1,999 checkout has not been validated; the existing checkout would add tax on top.
8. **Hochschulkompass and Study in Germany** must be added as trusted sources in Admin → Education → Sources (with their verified official URLs) before they appear; only sources in the registry are shown.
9. **Staging and production**: not started. No release tag, no release record.

## Behaviour changes to review before release

- Students can no longer open internal course pages, course comparison or saved courses. The student application-start flow began on the course page; it is now unreachable for students.
- `/universities` and `/courses` no longer list internal records to the public, and the sitemap no longer lists university or course URLs.
- `/universities/[slug]` answers 200 with a locked preview for visitors without access (it no longer reveals whether a record exists).

## Checks run on this branch

See the release notes in the kit for exact numbers. Not run: `npm run verify:visual` (Playwright reference run), database authorization tests, signed-in browser tests (no database in the build environment), Core Web Vitals.
