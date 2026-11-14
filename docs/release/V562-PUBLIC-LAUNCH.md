# V5.6.2 public launch: restricted public-marketing release

**Branch:** `release/v562-public-launch`, built on the approved tip `3f8c59d` (`preview/v562-approved`).
**Goal:** publish the approved V5.6.2 design to www.nextwise.world as a public website only. Student,
counsellor, admin, payment and AI functions stay closed until each is cleared on its own.

## 1. What changes, and what stays approved

**The approved design is unchanged:**
- the Home navigation item;
- the CIUX-01B header and page heroes;
- the V5.4 homepage, with the V5.6.2 Two Pathways choreography;
- the official contacts.

The approved-baseline tests (8/8) and the CC-24 hash pins pass, and none of the hash-pinned files was
edited.

**New:** a server-enforced launch mode (`src/lib/launch/launch-mode.ts`).

| Mode | When |
|---|---|
| `public-marketing` | `NEXTWISE_LAUNCH_MODE=public-marketing`; or the variable unset on a Vercel **Production** deployment; or any unknown value (fail closed) |
| `full-platform` | `NEXTWISE_LAUNCH_MODE=full-platform`; or the variable unset outside Vercel Production (local, Preview) |

## 2. How public-marketing mode is enforced (server side)

1. **`middleware.ts`** runs before every page, route handler and Server Action.
   - Only GET and HEAD are served. Every POST is refused with 405, including Server Actions, forms and
     webhooks. A `Next-Action` header is refused even on GET.
   - Only 22 public pages, their dynamic detail pages, `/go/course-search/*`, and static files are
     served. Deny by default: anything else returns 404, including `/admin`, `/counsellor`, `/api/*`
     and `/auth/*`.
   - Account entry points redirect (307) to `/book-counselling`. These are `/login`, `/register`,
     `/dashboard`, `/studio`, `/applications`, `/payments`, `/pay`, `/pricing/checkout` and the like.
     There, booking is by email or phone.
   - No Supabase session refresh runs. A visitor's existing auth cookie is ignored.
   - Each response carries `x-nextwise-launch-mode: public-marketing`, which release checks use.
   - The matcher no longer skips arbitrary paths ending in an image extension. Before, `/pay/<x>.png`
     skipped the middleware in every mode. Now only image files inside `public/`'s own folders skip it.
2. **Restricted layouts call `notFound()`** in this mode: admin, counsellor, studio, dashboard, profile,
   recommendations, agreements, applications, discovery-session, payments and pricing/checkout.
3. **Payments and AI are forced off in code** in this mode, whatever the environment variables say.
   - `resolvePaymentLaunchMode` returns `public_marketing_launch`.
   - `resolveAiConfig` returns `disabled`.
4. **The browser makes no Supabase call:**
   - `useAuthProfile` does not create a client;
   - the registration prompt is not mounted;
   - no cookies are set.

**Tests:**
- `src/lib/launch/launch-mode.test.ts` (113 tests). Every `page.tsx` and `route.ts` in the app is
  classified, and only the intended public set is served.
- `src/config/legal.test.ts` (24 tests).

## 3. What the website mode does NOT fix: the database boundary

The Supabase URL and publishable key are public by design; the current live site already ships them.
Anyone can call PostgREST and the RPCs directly, without this website. Closing routes in the app
therefore does not close the database. **The database is protected only by RLS, grants and the Supabase
Auth settings.** A frontend or middleware flag is not a fix for them.

What the public can reach directly, and what this release requires:

| Finding | Who can reach it | Release requirement |
|---|---|---|
| CC-25 0024: `anon` can execute `record_system_audit_log`, `set_signature_document_path`, `set_stamp_document_path` (forged audit rows and document paths; reproduced) | **Anyone**, with the public key | **Must be closed in production** (gate DB-1): `supabase/release/v562_prod_0024_*` after backup and approval |
| New accounts via the Auth API (S8: a student can create unpaid invoices; junk accounts; confirmation-mail abuse) | Anyone, if sign-ups are on | **Switch off** "Allow new users to sign up" and anonymous sign-ins (gate DB-7). Dashboard setting, reversible |
| F2–F5 and NW07 S1/S11: counsellor self-claim, session hijack, historical and inactive access | **Only a counsellor login.** Only an admin can create a counsellor (gate DB-4 verifies this) | Not reachable by the public. The owner confirms every active counsellor account is trusted (gate DB-6). The fix stays 0023 r2 + 0025 after the QA cycle (CC26-13 §6b) |
| TRUNCATE grants to clients (P2) | Nobody through PostgREST (no TRUNCATE endpoint) | Reported; fixed by 0025 later |

## 4. Gates before staging (all must pass; there is no sign-off override)

| Gate | Check | How |
|---|---|---|
| G1 Source | Exact commit, descends from `3f8c59d`, clean checkout | Stage script |
| G2 Tests | `npm ci`, typecheck, lint, approved-baseline, full Vitest, audit | Stage script |
| G3 Legal | `LEGAL_REVIEW.status === "approved"` with approver, date and effective date | Stage script reads `src/config/legal.ts` at that commit |
| G4 Database | `v562-evaluate-inspection.mjs` exits 0 (DB-0…DB-8) | You run the read-only SQL, then the stage script evaluates it |
| G5 Vercel env | Production has no `NEXTWISE_LAUNCH_MODE=full-platform` | `vercel env ls production` (names only) and the `x-nextwise-launch-mode` header on the staged URL |
| G6 Staged build | `v562-validate-deployment.mjs <staged URL>` exits 0 | Stage script, after the deploy |

## 5. Procedure

**A. Code**
1. Fetch the release bundle into your repository and push the branch. The commands are in the kit README.

**B. Legal**
1. Get the drafts reviewed (`docs/release/V562-LEGAL-REVIEW.md`).
2. Commit the approval in `src/config/legal.ts`.

**C. Database, read-only**
1. In the Supabase dashboard, open the **production** project → SQL editor.
2. Run `supabase/release/v562_prod_inspection_readonly.sql`. It is one SELECT and writes nothing.
3. Save the single result value as `prod-inspection.json`.
4. Fill in `docs/release/prod-attestation.template.json` as `prod-attestation.json`.
5. Run `node scripts/release/v562-evaluate-inspection.mjs prod-inspection.json prod-attestation.json`.

**D. Database fixes, only if gates fail, and only after a backup and separate approval**
- **DB-1 FAIL:** apply `supabase/release/v562_prod_0024_revoke_anon_internal_rpcs.sql`.
  - It accepts only the production approval value.
  - It refuses on any drift: function body hashes, exact grants or owner.
  - It changes three grants only. The rollback restores the exact earlier grants; this was rehearsed.
- **DB-7:**
  1. Go to Authentication → Sign In / Providers.
  2. Turn off "Allow new users to sign up".
  3. Turn off "Allow anonymous sign-ins".
- Re-run step C.

**E. Stage**
```
.\STAGE-V562-PUBLIC-LAUNCH.ps1 -Stage -ReleaseSha <commit> -Inspection prod-inspection.json -Attestation prod-attestation.json
```
- The script runs `vercel deploy --prod --skip-domain` and validates the staged URL.
- It writes `RELEASE-RECORD.txt`, which records the current production deployment as the rollback.

**F. Promote, by hand, after you have looked at the staged URL**
```
vercel promote <staged-url> --scope <team> --timeout 5m
```
or `.\STAGE-V562-PUBLIC-LAUNCH.ps1 -Promote <staged-url>` (you must type PROMOTE). Afterwards it checks
that www.nextwise.world serves the new header and `x-nextwise-launch-mode: public-marketing`.

**G. Rollback**
```
vercel rollback <recorded production URL> --scope <team>
```
or `-Rollback <url>` (you must type ROLLBACK). This puts the domain back on the previous deployment. It
does not change the database.

## 6. Opening the platform later

Set `NEXTWISE_LAUNCH_MODE=full-platform` only after each restricted area has its own clearance:
- CC-26 acceptance;
- 0023 r2, 0025 and 0026 applied and tested;
- payments CC-19/CC-20;
- AI approvals.

The other switches still apply in full-platform mode.
