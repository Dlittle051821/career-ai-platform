# CC25-07: Vercel staging deployment report

## Status: BLOCKED (needs your authorization and access)

| Step | Status | Why |
|---|---|---|
| Local CC-25 commit | **NOT RUN** | The PC has no shell in this session. `Finish-CC25.ps1 -InstallDependencies -Commit` creates it after every check passes. |
| Push `cc25/staging-acceptance` to GitHub | **BLOCKED** | Needs your authorization. This session has no GitHub access. |
| CC-25 Preview on Vercel (`nextwise-world-sta`) | **BLOCKED** | Needs the push, plus branch-scoped QA variables set by you. This session has no Vercel access. |
| Browser acceptance on the Preview | **NOT RUN** | No Preview exists. A local production build of the identical code was tested instead (CC25-04/05). |
| Baseline evidence: the existing CC-24 Preview `nextwise-world-7jei5rtte-nextwise.vercel.app` (`3d5e373`) | Taken from your report, **not re-run** by Claude | Initial public routes and correct 404s for invalid career, course and university records. |

A successful build isn't proof of a working authenticated journey. Signed-in journeys on the Preview therefore stay **NOT RUN** until it exists.

## 1. Prerequisites

1. `Finish-CC25.ps1 -InstallDependencies -Commit` finished with every check PASS on the PC.
2. **Decide on QA migration 0023 first** (CC25-02 §8).
   - The CC-25 build also runs **without** 0023: counsellors then see "Student details restricted" and the admin approval card says approvals start after the database update.
   - To accept the counsellor journey on staging, 0023 must be on QA.

## 2. Vercel environment: QA only, CC-25 branch only

In Vercel → `nextwise-world-sta` → Settings → Environment Variables, add each variable for **Preview**, limited to the Git branch **`cc25/staging-acceptance`** (the "Preview (select branch)" option).

**Don't edit the general Preview values**: other branches would pick them up and could reach the wrong database.

| Variable | Value | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ynwzijulzksmrcwdhudv.supabase.co` | QA only. Never `bwlkxunujngksibfzzfv`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | QA publishable (anon) key | From the QA dashboard. |
| `SUPABASE_SERVICE_ROLE_KEY` | QA service-role key, *only if* the Preview must run the signature/stamp webhooks | Not needed for the CC-25 journeys. Leave it unset if unsure. |
| `NEXT_PUBLIC_APP_URL` | The Preview URL | Used in email links. QA Auth → URL configuration must allow it as a redirect. |
| `NEXTWISE_PAID_CHECKOUT`, `NEXTWISE_PAID_CHECKOUT_PREREQUISITES`, `RAZORPAY_*`, `OPENAI_API_KEY`, `AI_*` | **Leave unset** | Payments and paid AI stay off. |

Don't change production variables, domains or aliases, and don't promote the deployment.

## 3. Deploy and verify

1. `git -C C:\ClaudeBuilds\CC25-STAGING-ACCEPTANCE push -u origin cc25/staging-acceptance`. A plain push: no force.
2. In Vercel, wait for the Preview of that branch. Check that the deployment's commit is the CC-25 commit from step 1 and that its branch is `cc25/staging-acceptance`.
3. Run the signed-out smoke test from the milestone folder:
   `powershell -ExecutionPolicy Bypass -File .\Verify-CC25-Staging.ps1 -BaseUrl <preview-url> [-BypassToken <token>]`
   - It covers 10 public pages (200, no error page), 3 invalid URLs (real 404), 6 protected routes (redirect to login), the V5.4 homepage and the absence of the production project ref.
   - It refuses `nextwise.world`.
   - Locally it passed **21/21** against the same build.
4. Check the Vercel runtime logs for errors while browsing.
5. Run the signed-in journeys in CC25-09 §4 with fictional QA accounts.

## 4. Rollback

- **Preview only:** delete the deployment, or remove the branch-scoped variables. Production isn't touched.
- **QA database:** follow the rollback procedure in CC25-02 §8.
