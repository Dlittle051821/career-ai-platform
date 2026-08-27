# Admin System Guide (Milestone 7)

This is the reference for the internal admin system at `/admin` — its architecture, its authorization model, every
database table it owns, and the honesty/safety rules each module follows. It assumes familiarity with Milestone 2
(Supabase authentication), Milestone 3 (Student Digital Profile), and Milestone 4 (Career Knowledge Base); it does
not modify any of those milestones' tables, RLS policies, or routes.

If you only read one thing before touching this system: **hiding a navigation link is not authorization.** Every
boundary described below is enforced twice — once in a server action or data-access function, and independently
again by a PostgreSQL RLS policy that does not trust the application at all. If the two ever disagree, the RLS
policy is what actually protects the data.

## 1. Architecture overview

`/admin` is a second, independent root layout, not a section bolted onto the public site:

```
src/app/(site)/layout.tsx   Public + student site root layout (Header/Footer, unchanged M1-M6 behavior)
src/app/admin/layout.tsx    Admin root layout (AdminShell, no public marketing chrome)
src/app/admin/**            Every admin route
src/lib/fonts.ts            Shared font config both root layouts import, so they never drift
```

Next.js App Router route groups (`(site)`) don't affect URLs — `src/app/(site)/careers/page.tsx` still serves
`/careers` exactly as it did before Milestone 7. The split exists purely so the admin shell never renders the
public header/footer, and so a public page's layout is never forced dynamic by something an admin page needs.

Every admin request passes through three independent layers, all of which must agree before a mutation succeeds:

1. **Middleware** (`src/lib/supabase/middleware.ts`) — `/admin` is a protected path. An unauthenticated visitor is
   redirected to `/login` before any admin code runs at all.
2. **`src/app/admin/layout.tsx`** — resolves the caller's admin role server-side via `getCurrentAdmin()`
   (`src/lib/supabase/admin-auth.ts`). No role → an inline access-denied page is rendered (see §3). This never
   redirects to a separate `/admin/...` page, because that page would hit this exact same check and loop.
3. **Every data-access function and server action** (`src/lib/supabase/admin/*.ts`) — calls `requireAdmin()` /
   `requireAdminRole()` / `requireAdminPermission()` again itself, and the query it then runs is additionally
   filtered by that table's own RLS policy. A page-level check alone would still leave a server action reachable
   directly (e.g. via a stale bookmark, a replayed form submission, or a bug in the page's own gating) — every
   mutation re-derives and re-checks the caller's role from the database, every time.

**No service-role key is used anywhere in Milestone 7.** Every admin read and write goes through the same
RLS-respecting publishable-key Supabase client every other milestone uses (`src/lib/supabase/server.ts`). The role
model in §2 and the RLS policies in §5 are what make that safe — an "admin" is not a bypass of RLS, it is a role
RLS policies explicitly recognize and grant broader (but still scoped) `select`/`insert`/`update` access to.

## 2. Roles & permissions

Six roles, stored in the `admin_roles` table (§5), one per admin user:

| Role | Description |
|---|---|
| `super_admin` | Full access to every module, plus the only role that can grant/revoke admin roles. |
| `admin` | Manages every operational module (students, universities, courses, applications, leads, agreements, counsellors, content) and reads payments/analytics/audit log. Cannot manage roles. |
| `counsellor` | Reads/writes only their own assigned students, leads, and applications; reads agreements. No access to payments, universities/courses editing, content, or the audit log. |
| `finance` | Reads/writes payments; reads applications and analytics. No access to students, leads, universities/courses, agreements, content, counsellors, roles, or the audit log. |
| `content_editor` | Reads/writes the content module only. |
| `analyst` | Read-only across students, leads, applications, payments, agreements, and analytics. Zero write permissions anywhere. |

The full permission list lives in `src/lib/admin/permissions.ts` (`ADMIN_PERMISSIONS`) and the role → permission
mapping in the same file (`ROLE_PERMISSIONS`) — that file is the single source of truth the admin shell's
navigation and every server action check against. A student account (`account_type = 'student'`, no `admin_roles`
row) has zero entries in that map and cannot reach any `/admin` route or any admin-only data — see §5 for how this
is enforced at the database level independently of this file.

This file is application-level only. Every table it maps to also has its own RLS policies in
`supabase/migrations/0004_admin_system.sql`, written directly in terms of role names via `is_admin_role()` — not by
reading this file. If `permissions.ts` and the RLS policies were ever to disagree, RLS wins.

**Privilege-escalation prevention**, concretely:

- `admin_roles` has no `insert`/`update`/`delete` RLS policy for anything but `super_admin` — an `admin` account
  has no database grant to write that table, full stop, regardless of what the application code does or fails to
  check.
- A trigger (`prevent_last_super_admin_removal`) blocks demoting or deleting the last remaining `super_admin`, so
  the system can never end up with zero people able to grant roles back.
- `counsellors` has no `role` column and no self-update RLS policy — a counsellor editing their own directory entry
  (display name, specializations, capacity) cannot grant themselves anything, because there is nothing on that row
  that grants anything.
- Every server action that writes an operational record re-derives the caller's current role from the database
  immediately before writing (`requireAdminPermission(...)` inside the mutation itself, not just at the page
  level) — a role revoked mid-session cannot keep acting on a stale page load.

## 3. Initial super-admin bootstrap

No account is ever automatically made an admin — not the first person to register, not anyone. This is
deliberate: an attacker registering first (or a race during setup) must never be able to grant themselves access.

To grant the very first `super_admin`:

1. Register a normal account through `/register` with the email you want to administer with.
2. Open your Supabase project's SQL Editor.
3. Run the commented-out `BOOTSTRAP` block at the very end of `supabase/migrations/0004_admin_system.sql`, with
   `'you@example.com'` replaced by that account's real email:

   ```sql
   insert into public.admin_roles (user_id, role, granted_by)
   select id, 'super_admin', id from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = 'super_admin', updated_at = now();
   ```

4. Verify: `select user_id, role, granted_at from public.admin_roles;`
5. Sign out and back in (or just refresh `/admin`) — the new role is read fresh on every request via
   `getCurrentAdmin()`, so no cache needs clearing.

From then on, every additional admin is granted through the admin UI itself by a `super_admin` (Students →
Counsellors → a future Roles view is out of scope for M7; until then, repeat the SQL above for additional admins,
substituting the role you want).

## 4. Student management module

Students never go through a create/edit form in `/admin` — they register themselves through the normal public flow
(`/register`, then Milestone 3's onboarding). `/admin/students` is deliberately **read-only for everything a
student self-reports**: name, email, phone, profile completion, and every `student_*` table from Milestone 3. The
only things an admin can change about a student are:

- **Operational status** (`prospect` / `active` / `inactive` / `archived`) — stored in `admin_student_meta`, never
  in `student_profiles`. Archiving is the preferred way to stop treating a student as active; there is no delete
  path for a student record anywhere in the admin UI (spec: prefer soft archive over destructive deletion).
- **Assigned counsellor** — also `admin_student_meta`. This is what scopes a `counsellor` role's RLS visibility
  (§5) to exactly the students assigned to them.
- **Internal notes** (`admin_student_notes`) — append-only; there is no edit or delete path for a note, so
  correcting one means adding a new one, not silently rewriting history.

`admin_student_meta` has no row for a student until an admin first touches them (assigns a status or a
counsellor) — every read treats a missing row as `status: "prospect"`, `assignedCounsellorId: null`, matching the
column defaults. The student detail page additionally shows read-only linked leads (leads whose
`converted_student_user_id` points at this student), applications, payments, and agreements — all fetched by
`student_user_id`, never editable from this page.

Passwords, session tokens, and any other Supabase Auth secret are never read, displayed, or stored by any admin
page — the admin system only ever touches `profiles`, `student_*`, and its own Milestone 7 tables.

## 5. Database schema & RLS policies

One migration, `supabase/migrations/0004_admin_system.sql`, adds fifteen new tables and layers additive `select`
policies onto eleven existing Milestone 2/3 tables. It never edits 0001-0003 in place, and it is safe to re-run
(every statement guards itself with `if not exists` / `drop policy if exists` / `create or replace`).

**New tables:**

| Table | Purpose |
|---|---|
| `admin_roles` | One role per admin user. The authorization source of truth (§2). |
| `counsellors` | Counsellor directory — no `role` column (§2). |
| `universities` | Master data for institutions. |
| `courses` | Master data for courses, linked to a university. |
| `admin_student_meta` | Admin-owned operational status + counsellor assignment for a student (§4). |
| `admin_student_notes` | Append-only internal notes about a student (§4). |
| `leads` / `lead_status_history` | Lightweight CRM pipeline + an auditable stage-change trail. |
| `applications` / `application_status_history` | Application tracking + stage-change trail. |
| `payments` | Operational payment tracking (§7). |
| `agreements` | Agreement/signature tracking (§8). |
| `content_items` | CMS entries — FAQs, announcements, page blocks (§9). |
| `conversion_events` | First-party funnel-transition log (§10). |
| `admin_audit_log` | Append-only audit trail (§12). |

Every table has `created_at`/`updated_at` timestamps (with a shared `set_updated_at()` trigger reused from earlier
milestones), row-level security enabled, explicit per-role policies (no table is left with RLS enabled but zero
policies, which would either silently deny everyone or, worse, be forgotten and left open), indexes on every
foreign key and every column a list page actually filters by, and check constraints for every status/enum field —
status values are always constrained `text`, never a free-form string a form could send anything into.

**RLS design decisions worth calling out:**

- **Additive-only policies on existing tables.** The eleven `for select` policies this migration adds to
  `profiles` and the ten `student_*` tables are *new* grants layered on top of the Milestone 2/3 policies — never a
  replacement. PostgreSQL evaluates every policy for the same command with `OR`, so a student's own
  `auth.uid() = id` access is completely untouched; these new policies can only ever widen who else can read that
  row (an admin, or a counsellor scoped to their own assigned students via a join against `admin_student_meta`),
  never narrow the student's own access to their own data.
- **`SECURITY DEFINER` helper functions**, not raw subqueries in every policy. `current_admin_role()`,
  `is_admin_role(role[])`, `is_any_admin()`, and `current_counsellor_id()` all read `admin_roles`/`counsellors` for
  `auth.uid()` only — they can never be used to look up anyone else's role, so `SECURITY DEFINER` here does not
  leak data, and it avoids the infinite-recursion problem of a policy on `admin_roles` querying `admin_roles`
  through its own (still-RLS-respecting) reads.
- **Counsellor scoping** is always expressed as "the assigned counsellor on this row equals my own
  `current_counsellor_id()`" — never "this row's owner is me" (a counsellor may not even have a linked login).
  Payments and universities/courses editing have *no* counsellor policy at all: a `counsellor` role simply cannot
  read or write those tables, by design (data minimization — a counsellor doesn't need to see financial records to
  do their job).
- **Money is always an integer** in the currency's minor unit (`amount_minor_units bigint`, paise for INR) —
  `src/lib/admin/money.ts` is the only place minor-units ↔ display-string conversion happens, and it is tested
  specifically against floating-point drift (e.g. `19.99` parses to exactly `1999`, never `1998.999...`).
- **`applications.deadlines`** is a small `jsonb` array of `{label, dueDate}` objects rather than a child table —
  a deliberate scope call for M7; if per-deadline history or reminders are ever needed, that would warrant
  promoting it to its own table with its own RLS in a later migration.

**No embedded relational selects anywhere in the admin data-access layer.** Every hand-written `Database` type in
`src/types/database.ts` declares `Relationships: []` (a pre-existing Milestone 4/5 convention — see that file's own
docblock), which means a Supabase client call like `.select("*, universities(name)")` cannot be typed and fails at
compile time. Every join in `src/lib/supabase/admin/*.ts` is therefore a small follow-up query plus an in-memory
`Map` (e.g. `buildUniversityNameMap()` in `courses.ts`/`applications.ts`) — the same avoid-N+1 pattern already used
by `src/lib/supabase/careers.ts` and `src/lib/supabase/admin/dashboard.ts`, never a full-table load.

## 6. Student operational metadata — why a separate table

`admin_student_meta` and `admin_student_notes` are new tables, not new columns on `student_profiles`. Three
reasons: the far more permissive Milestone 3 policies (a student can update their own `student_profiles` row)
should never be able to accidentally touch operational fields an admin controls; a student account with zero
`admin_student_meta` rows (the default, expected state for everyone who has never been touched by an admin) needs
no special-casing anywhere — it just means "prospect, unassigned"; and counsellor RLS scoping across leads,
applications, and student data all joins against `admin_student_meta.assigned_counsellor_id` as the single anchor
point, rather than five different tables each inventing their own notion of "my students."

## 7. Payments module — operational tracking only

**This is not a payment processor, and no code path in this project processes, captures, or moves money.** A
`payments` row records that an admin believes a payment happened or is expected — creating or editing one never
triggers an actual financial transaction, never talks to a bank or payment gateway, and a status of `paid` means
"an admin recorded that this was received," never "this system processed it." The payment form displays this
warning directly above every payment record's fields, and `docs/admin-system-guide.md` (this file) is the
authoritative statement of that limitation if the UI copy is ever missed.

Concretely: no card number, CVV, bank account, or other payment credential is ever read, requested, stored, or
logged anywhere in this codebase (the audit-log redaction helper in §12 additionally strips anything that looks
like one, as defense in depth even though nothing should ever produce it). Amounts are always integer minor units
(§5). Status changes follow a fixed transition graph (`PAYMENT_STATUS_TRANSITIONS` in `src/lib/admin/status.ts`) —
`pending → paid/failed/cancelled`, `paid → refunded/partially_refunded`, `failed → pending/cancelled` — enforced
server-side before any write, so a payment cannot jump straight from `pending` to `refunded` without ever having
been `paid`. Every status or amount change is written to the audit log (§12) regardless of what else changed on
the record, since those two fields are the financially sensitive ones. Write access (`payments:write`) is
restricted to `super_admin`, `admin`, and `finance` — a `counsellor` cannot read or write payments at all.

## 8. Agreements module — tracking only, no e-signature

There is no e-signature integration anywhere in this project. `signature_status` (`not_started` /
`pending_signature` / `signed`) is set manually by an admin who has verified the state some other way (in person,
by email, by a third-party tool outside this system) — it is never flipped automatically, and the form says so
directly. `document_reference_url` is a plain reference link an admin types in (e.g. to a file stored in Google
Drive or another system already in use); nothing is uploaded to or stored by this application, and no document
content is ever rendered from here. An agreement must be linked to at least one party (a student, a counsellor, or
a university — enforced by a database check constraint), and status changes follow
`AGREEMENT_STATUS_TRANSITIONS`/`SIGNATURE_STATUS_TRANSITIONS` (`src/lib/admin/status.ts`) the same way payments and
applications do. Write access is `super_admin`/`admin` only; a `counsellor` can read agreements linked to them but
never create or edit one.

## 9. Data honesty & content safety

Two related rules run through every module that could otherwise mislead a student or a future integration:

**Never claim more certainty than is actually known.** `universities.accreditation_status` defaults to
`unverified` and the admin form warns explicitly never to mark a university `verified` without supporting evidence
on file. `courses.data_quality_status` (`draft` / `reviewed` / `approved`) exists so a course record can be
entered without implying it has been checked. No form anywhere lets an admin invent a live fee, a ranking, an
admission guarantee, a visa outcome, or a scholarship claim — every such field is either a plain optional text
field an admin fills in from a real source, or is simply left blank. `is_visible` on universities/courses is
separate from `is_active` and is currently inert forward-compatible groundwork: **no public page reads this table
in Milestone 7** — the existing static/typed career content from Milestone 4 is left completely untouched, and
nothing here changes what a student sees anywhere on the public site until a future milestone explicitly wires a
page to read from it.

**CMS body content is always plain text, never HTML.** `content_items.body` is rendered exclusively through React
text nodes (which auto-escape) — there is no `dangerouslySetInnerHTML` anywhere in this feature, and
`src/lib/admin/content.ts` only ever splits/truncates/normalizes the string for display, never interprets it as
markup. This means a `content_editor` (or anyone who compromises that role) cannot inject a script by editing
content, full stop — there is no code path that would ever execute what they typed. Public content reads (a
future page fetching `status = 'published'` rows) use the same anon-readable RLS policy already in the migration,
but again: **no public page does this yet in M7.** Every existing typed/static page's copy stays exactly as it was
through this milestone.

## 10. Conversion tracking

`conversion_events` is a first-party, admin-authenticated-only log — there is no public or anonymous write path,
no client-supplied timestamp (`occurred_at` always defaults to the server's `now()`, so a browser cannot forge
when something happened), no fingerprinting, and no raw IP address is ever stored. An event is written only when a
real admin action happens (for example, a lead's stage moving to `converted`), never on page load or by a tracking
script. Fields recorded: `event_name`, `source`/`medium`/`campaign`/`landing_page`/`referral_label` (all
optional, first-party attribution only — no third-party ad-platform integration exists), and an optional link to
the `lead_id`/`student_user_id` the event is about. Read access is `super_admin`/`admin`/`analyst`; write access is
any admin role, but only through an authenticated admin session.

**Privacy limitation to know:** because this is a manually-triggered internal log rather than a client-side
analytics beacon, it will under-report compared to a full marketing analytics tool — it captures what an admin
recorded, not everything a visitor did. That tradeoff is deliberate: it avoids fingerprinting and third-party data
sharing entirely, at the cost of completeness.

## 11. Analytics

Every figure on `/admin/analytics` and the admin dashboard is computed from the database on each request — no
cached/precomputed snapshot, and no full-table row load. Counts use `count: "exact", head: true` queries (zero
rows transferred); the "top N" breakdowns (lead sources, university interest) and the revenue total load only the
one or two narrow columns they need, never a full row, and are capped (`limit: 5` for top-N lists) with that cap
stated in the UI rather than silently truncated.

**Metric definitions:**

- **Lead funnel** — a live count of leads currently in each `stage`, with each stage's share of the range's total
  leads (`withShareOfTotal()`). Share is `null`, not `0%`, when there are zero leads in range.
- **Lead-to-student conversion** — leads whose `stage = 'converted'`, divided by all leads in range.
- **Application stage distribution** — a live count of applications currently in each `stage`.
- **Application offer rate** — applications currently at `offer_received` or `enrolled`, divided by all
  applications in range. This is a snapshot of current stage, not a true historical "ever received an offer" rate
  (an application that was offered and later withdrawn would not count) — documented here rather than silently
  assumed.
- **Payment status distribution / recorded revenue** — revenue is the sum of `amount_minor_units` for payments
  with `status = 'paid'`, summed separately per currency (`sumRecordedRevenue()` in `src/lib/admin/analytics.ts`)
  — amounts in different currencies are never added together into one misleading total.
- **Counsellor workload** — active students (an `admin_student_meta` row assigned to this counsellor), open leads
  (assigned, stage not `converted`/`lost`), and active applications (assigned, stage not
  `enrolled`/`rejected`/`withdrawn`) currently assigned to each counsellor. "Active"/"open" here always means
  "currently in a non-terminal state," not a time-windowed count.
- **Top lead sources / top universities by application interest** — a simple count of non-null values for that
  column, highest first, limited to 5.

**Zero/small-denominator handling:** `computeRate()` (`src/lib/admin/analytics.ts`) returns `percent: null` — not
`0%` and not `NaN` — for a zero denominator, and flags `isReliable: false` for any denominator below 5 records
(`MIN_RELIABLE_SAMPLE_SIZE`). The analytics page renders `null` as "No data yet" and an unreliable-but-computed
percentage with an explicit "small sample" caveat next to it, rather than presenting either as a confident number.

Every admin's view is subject to the same RLS as everywhere else — a `counsellor` role querying, say, the
dashboard would only ever see counts scoped to what RLS actually returns for their session; the analytics module
itself does not add student-level detail to any aggregate (no list of which student is behind a count), so viewing
an aggregate is never a way around the per-record access rules elsewhere in the system.

## 12. Audit log

`admin_audit_log` is append-only by construction, not just by convention: the table has **no** `insert` RLS policy
for `authenticated` at all. The only way a row is ever created is the `record_admin_audit_log()` SQL function
(`SECURITY DEFINER`), which forces `actor_user_id = auth.uid()` and stamps `created_at` server-side — a caller
cannot forge acting as someone else, backdate an entry, or write directly to the table bypassing the function.
There is also no `update`/`delete` policy for anyone, including `super_admin` — the log cannot be edited or
purged through this application at all.

Every sensitive mutation across every module (create/update on universities, courses, applications, leads,
payments, agreements, counsellors, content; student status/counsellor-assignment/note changes) calls
`recordAuditLog()` (`src/lib/supabase/admin/audit.ts`) after the mutation itself succeeds. Each entry records the
actor's user ID and role, the action taken, the entity type and ID, a short human-readable summary, and — where
relevant — a redacted before/after change set. `redactSensitiveFields()` (`src/lib/admin/audit.ts`) recursively
strips any object key matching password/token/secret/API-key/credential/card-number/CVV/SSN/service-role patterns
before anything is written, as defense in depth on top of the fact that no admin form collects those values in the
first place. If the audit write itself fails, it is logged server-side and swallowed — the real mutation that
already succeeded is never rolled back or blocked by a failure in its own audit trail, since the trail is
best-effort on top of a source-of-truth write that already happened.

Read access is `super_admin`/`admin` only (`audit:read` in §2); `/admin/audit-log` supports filtering by entity
type and paginates 50 entries at a time.

## 13. Testing

Automated tests cover every pure business-logic module under `src/lib/admin/*.test.ts` (run via `npm run test`,
included by `vitest.config.mts`'s `src/lib/admin/**/*.test.ts` glob):

- `permissions.test.ts` — the full role → permission mapping, including that `admin` never has `roles:manage` and
  that every role's permission list matches the spec's stated examples.
- `money.test.ts` — minor-unit parsing/formatting, specifically including float-drift traps (`19.99` → exactly
  `1999`, never `1998.999...`), rejection of negative/malformed input.
- `status.test.ts` — every transition graph (leads, applications, payments, agreements, signatures, content),
  confirming same-status-to-same-status is always allowed and that undefined jumps are rejected.
- `analytics.test.ts` — zero-denominator safety (`percent: null`, never `0%`/`NaN`), the reliability threshold,
  share-of-total math, and revenue summation ignoring non-`paid` statuses.
- `content.test.ts` — body normalization/truncation, paragraph splitting, and slug validation (never producing or
  accepting anything that could be mistaken for HTML).
- `audit.test.ts` — recursive redaction of every sensitive key pattern, and change-set/summary construction.
- `pagination.test.ts` — page/page-size parsing and clamping, and filter-param cleaning.

These are unit tests of pure functions and do not require a database connection, which is what allows them to run
in this sandbox and in CI without live Supabase credentials. Full end-to-end coverage (a real signed-in session
hitting real RLS policies) is described as a manual verification checklist in the top-level delivery notes for this
milestone, since it requires a live Supabase project this sandbox does not have credentials for.

## 14. Manual migration & optional seed instructions

**Migration** (you run this manually — nothing in this delivery touches your live database):

1. Open your Supabase project's SQL Editor.
2. Paste the entire contents of `supabase/migrations/0004_admin_system.sql` and run it. It is safe to run more than
   once.
3. Follow §3 above to grant yourself the first `super_admin`.
4. Update your local TypeScript types if you regenerate them from the live schema — this project ships a
   hand-written `src/types/database.ts` already updated to match this migration, so regeneration is optional, not
   required.

**Optional dev seed** (`supabase/seed/0002_admin_dev_seed.sql`) — never run automatically, entirely optional, and
separate from the Milestone 4 career seed (`0001_careers_seed.sql`). It populates counsellors, universities,
courses, a few unlinked leads, two unlinked payment records, two agreements, and two content items — all obviously
fictional data, clearly labeled as sample records in every `internal_notes` field, safe to re-run (`on conflict do
nothing` on fixed UUIDs). It deliberately does **not** seed students, `admin_student_meta`, or applications, since
those require a real Supabase Auth account that plain SQL cannot safely fabricate — see the seed file's own header
comment for how to link a real local test account instead. The admin UI is fully functional with zero rows from
this file; every list page's empty state is honest, not a placeholder.

## 15. Known limitations & future integrations

- **No live payment processor, no e-signature provider, no SMS/WhatsApp/email sending integration.** Every module
  that references these (payments, agreements, leads' "contact" fields) is explicitly tracking-only, as documented
  in §7, §8, and the lead form's own on-page warning. Wiring any of these up is future work, not part of M7.
- **No public page reads `content_items` or the `is_visible` flag on universities/courses yet.** This is
  intentional scope control for M7 (§9) — a future milestone can wire a page to read published content without any
  change needed here.
- **Application tracking has no live university integration.** Every stage/status change is a manual, admin-entered
  record, never a synced status from a real admissions system.
- **Top-N analytics lists are capped at 5** and the UI does not currently surface "and N more" — a reasonable
  follow-up if the underlying tables grow large enough for that to matter.
- **No dedicated "manage other admins" UI** beyond direct SQL (§3) — a `super_admin` can currently only grant
  additional roles by running SQL, not through `/admin` itself. A future milestone could add a Roles module gated
  on `roles:manage`, following the same server-action-plus-RLS pattern as every other module here.
- **Deadlines on an application are a small JSON array**, not a separate auditable table (§5) — acceptable for
  M7's scope; would need promoting to a real table if per-deadline reminders or history become a requirement.
