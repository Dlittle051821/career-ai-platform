# Installing Milestone 11 — Inclusions, Presentation Fields & Brand Tokens

This is the exact, step-by-step install procedure for the Milestone 11 upgrade: structured plan inclusions,
presentation/comparison fields (session counts, limits, counsellor tier, etc.), the redesigned `/pricing` page, the
`--brand-*` visual-identity token system, and the light-touch invoice PDF accents.

It assumes you already have Milestones 7, 8, and 10 installed and working (admin system, payments/billing, and the
original NextWise Pricing & Offers system) — see the main [`README.md`](./README.md) for those. Everything below is
**additive**: it extends migrations `0004`, `0005`, and `0007` with a new numbered migration and a new numbered
seed; nothing in `0001`–`0007` or `0001`–`0004` (seeds) is altered.

Nothing here requires code changes on your part — this is purely a database install + verification checklist. No
`.env.local` changes, no new secrets, no new dependencies.

## What you're installing

| File | What it does |
| --- | --- |
| `supabase/migrations/0008_pricing_inclusions_and_presentation.sql` | Adds the `pricing_plan_inclusions` table (structured, admin-editable, immutable-once-published service bullets), ten new presentation/comparison columns on `pricing_plan_versions` (session count, shortlist/application-support limits, SOP review rounds, mock-interview count, counsellor tier, support-duration note, etc.), extends the immutability trigger to cover them, and extends `purchase_pricing_plan()` to snapshot the inclusions/limits that were live at the moment of purchase into three new columns on `pricing_purchases`. |
| `supabase/seed/0005_pricing_inclusions_seed.sql` | Idempotently loads the verbatim, official inclusion bullets, session counts, and comparison limits for all nine NextWise plans (as a new draft version per plan, then publishes it and archives the prior version). Never touches any price. |

Application code (types, admin UI, public `/pricing` page, checkout, invoice PDFs) is already in this repository and
requires no separate install step — it activates automatically once the migration and seed above are applied. Before
they're applied, the app keeps working exactly as it did under Milestone 10 (the new columns are all nullable, the
new table is simply empty, and every UI path has a graceful fallback — see "Rollback / skipping this" below).

## Prerequisites

- Migration `0007_nextwise_pricing_offers.sql` already applied (Milestone 10).
- Seed `0004_pricing_offers_seed.sql` already applied (the nine base plans/prices exist).
- A Supabase project with SQL Editor access, and (for the manual verification queries below) at least one account
  holding `super_admin`, `admin`, `finance`, or `analyst`.

## Install steps

**Step 1 — Apply the migration.**
Open the Supabase SQL Editor, paste the full contents of
`supabase/migrations/0008_pricing_inclusions_and_presentation.sql`, and run it. It is idempotent (`create table if
not exists`, `add column if not exists`, `create or replace function`, `drop policy/trigger if exists` before
re-creating) — safe to re-run if you're ever unsure whether it already applied.

**Step 2 — Load the seed data.**
Paste the full contents of `supabase/seed/0005_pricing_inclusions_seed.sql` into the SQL Editor and run it. Also
idempotent — every insert is guarded by a `where not exists (...)` check, so re-running it is a no-op. This step:

1. Creates a new draft version (version 2) for each of the nine plans, copying the existing price/currency/CTA/tax
   status/exclusions from version 1 unchanged, and filling in the new presentation fields with the exact values from
   the client specification.
2. Inserts every verbatim inclusion bullet for each plan (~126 rows total across all nine plans).
3. Publishes each new version.
4. Archives the prior (version 1) published version for each plan.
5. Repoints `pricing_plans.current_version_id` at the new version.

No price changes anywhere in this seed — every plan's `amount_minor_units`/`currency` is copied forward unchanged
from the version it replaces.

**Step 3 — Verify.**
Run these in the SQL Editor (also documented as comments at the bottom of the migration file, PART 7):

```sql
-- 1) Only `authenticated` can execute purchase_pricing_plan() — anon/PUBLIC cannot.
select
  has_function_privilege('authenticated', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as authenticated_can,
  has_function_privilege('anon', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as anon_can,
  has_function_privilege('public', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as public_can;
-- expected: true, false, false

-- 2) All nine plans now have a published version with a session count and inclusions.
select p.slug, pv.version_number, pv.session_count,
  (select count(*) from public.pricing_plan_inclusions i where i.plan_version_id = pv.id and i.is_active) as inclusion_count
from public.pricing_plans p
join public.pricing_plan_versions pv on pv.id = p.current_version_id
order by p.display_order;
-- expect 9 rows, every session_count and inclusion_count non-null / > 0.

-- 3) The new inclusion-immutability trigger blocks editing a published version's inclusions.
update public.pricing_plan_inclusions i
  set title = title || ' (edited)'
  from public.pricing_plan_versions v
  where v.id = i.plan_version_id and v.status = 'published'
  limit 1;
-- expected: raises an error ("... immutable once their parent version leaves draft ...")

-- 4) The extended version-immutability trigger blocks editing a published version's new columns.
update public.pricing_plan_versions set session_count = coalesce(session_count, 0) + 1
  where status = 'published' limit 1;
-- expected: raises an error ("A published or archived pricing plan version is immutable ...")
```

If (3) or (4) succeeds instead of raising an error, stop and re-check that the migration actually applied — do not
proceed to production with a version-immutability trigger that isn't working.

**Step 4 — Visit the app.**
- `/pricing` now shows three tabs (School Guidance / Bachelor Abroad / Master Abroad), the structured "What's
  included" list with a "View all services" dialog, session counts, and an accessible comparison table for each tab
  with more than one plan.
- `/admin/pricing/[id]/versions/[versionId]` (for a draft version) now shows an "Inclusions" manager (add, edit,
  reorder, remove) and a "Presentation & comparison-table settings" form section, alongside the existing price-form
  fields.
- Existing invoices/purchases from before this migration are untouched and continue to display exactly as they did
  under Milestone 10 — the new snapshot columns on `pricing_purchases` default to an empty state (`null` session
  count, `[]` inclusions, `{}` limits) for any row created before this migration, which the UI treats the same as
  "nothing to show," not as an error.

## Rollback / skipping this entirely

You do not have to run this migration or seed at all — `/pricing` and checkout continue to work exactly as they did
under Milestone 10 without it (every new column is nullable, `pricing_plan_inclusions` is simply empty, and every UI
read path falls back to the legacy free-text `included_services` list, then to the neutral "Contact NextWise for the
detailed service scope." message). There is no destructive step to undo: this migration adds tables/columns, it
never drops or rewrites anything from `0001`–`0007`.

If you do want to remove it after installing, you would need to write your own down-migration (none is provided, in
keeping with this repo's "migrations are never altered or reverted in place" convention — see
`docs/nextwise-pricing-offers-guide.md` and the header comments in `supabase/migrations/0007_nextwise_pricing_offers.sql`
for why). Dropping `pricing_plan_inclusions` and the new columns on `pricing_plan_versions`/`pricing_purchases` is
safe from a data-integrity standpoint (nothing outside Milestone 11 code reads them), but would destroy the
inclusions/limits snapshot on any purchase made after this migration was applied — treat that as a real, deliberate
data-loss decision, not a routine rollback.

## Visual identity tokens — no install step needed

The `--brand-*` CSS custom properties in `src/app/globals.css` and the light-touch color accents in
`src/lib/payments/pdf.ts` are plain code changes already committed in this repository — there is nothing to run in
Supabase for them. If NextWise later finalizes its brand guide and any of the `PROVISIONAL`-labeled token values
need to change (see the comment on each token's declaration line in `globals.css`), that is a one-file edit to
`src/app/globals.css`: update the hex value and, if it's now a confirmed/approved color, update its label from
`PROVISIONAL` to `REAL` and remove it from `REAL_TOKENS`'s complement in
`src/config/brand-tokens.test.ts`'s "marks every non-real brand token as PROVISIONAL" test data if you want the test
to start requiring the new REAL label (the test currently only requires labeling, not a specific REAL/PROVISIONAL
split, beyond the fixed three original REAL tokens plus `--brand-surface`, `--brand-focus`,
`--brand-danger`/`-pale`, which are aliases/derivations of already-REAL values). No component code references a raw
hex value, so a token value change never requires touching `.tsx` files.

`--color-accent` (and `-dark`/`-light`) is deliberately never aliased to any `--brand-*` token — see the comment
directly above its declaration in `globals.css` and `src/config/brand-tokens.test.ts`'s dedicated regression test.
