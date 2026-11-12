# CC26-12: QA Preview deployment

## Status: PREPARED, NOT DEPLOYED (needs your authorization)

| Step | Status | Why |
|---|---|---|
| Local CC-26 commit | **NOT RUN** | No shell on the PC in this session. `Finish-CC26.ps1 -Commit` makes it after every check passes. |
| Push `cc26/launch-readiness` | **BLOCKED** | Remote deployment needs your explicit authorization (approval A5). This session has no GitHub or Vercel access. |
| CC-26 Preview on Vercel against QA | **BLOCKED** | Needs the push, and branch-scoped QA variables set by you |
| Signed-out smoke test of the Preview | **Rehearsed locally: 24/24 PASS** against the identical production build (`Verify-CC26-Preview.ps1 -BaseUrl http://localhost:3026 -AllowHost localhost`) | The real run waits for the Preview |
| Signed-in journeys on the Preview | **NOT RUN** | No Preview exists; the identical build was tested locally (CC26-06) |

## 1. Order

1. `Finish-CC26.ps1` (dry run), then `Finish-CC26.ps1 -Commit`, on the PC.
2. QA database: preflight (A1), then apply 0023 r2, 0024 and 0025 (A2), and optionally 0026 (A3); see CC26-02.
   - The CC-26 build runs without them: identity falls back, and checkout is paused in the app.
   - The counsellor approval journey and the security fixes are only real on QA after A2.
3. Push and create the Preview (A5).

## 2. Vercel variables: Preview, branch `cc26/launch-readiness` only

These are the same as CC-25 (CC25-07 §2), scoped to the new branch:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the QA project URL only (never the production project) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the QA publishable key |
| `NEXT_PUBLIC_APP_URL` | the Preview URL (allowed as a redirect in QA Auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | only if signature or stamp webhooks are exercised; otherwise leave unset |
| `NEXTWISE_PAID_CHECKOUT*`, `RAZORPAY_*`, `OPENAI_API_KEY`, `AI_*` | **leave unset** |

Never change production variables, domains or aliases, and never promote the deployment.

## 3. Verify

1. `git -C C:\ClaudeBuilds\CC26-LAUNCH-READINESS push -u origin cc26/launch-readiness` (a plain push: no force).
2. Confirm that the Preview's commit is the CC-26 commit.
3. `Verify-CC26-Preview.ps1 -BaseUrl <preview-url> [-BypassToken <token>]`. It refuses `nextwise.world` and covers:
   - 10 public pages and 3 genuine 404s;
   - 8 protected routes, now including `/applications` and `/applications/<id>`;
   - the V5.4 hero and its 6 skip links;
   - the absence of the production project ref.
4. Signed-in checks with **fictional** QA accounts, on desktop Chrome **and** on the BLOCKED browsers (Edge, Firefox, Safari, iPhone, Android):
   - register, confirm, log in and log out;
   - complete onboarding; save and resume the profile;
   - Career Explorer, University and Course Explorer, saved items and comparison;
   - book a Discovery Session;
   - **admin approves** the assignment; the counsellor then sees the student's name, and before approval only "Awaiting admin approval";
   - deactivate a fictional counsellor: their caseload and queue disappear;
   - `/applications/<random uuid>` shows the not-found page, and the browser's network tab shows **404**;
   - the pricing page shows ₹1,999 tax-inclusive, with no way to pay;
   - homepage: Tab once and the first skip link appears; turn on reduced motion and the page stays calm.
5. Check the Vercel runtime logs while browsing.

## 3b. Signed-out verification done (2026-11-12, built-in browser)

On the Preview the following was checked signed out:
- the client bundles name only `ynwzijulzksmrcwdhudv`, with no production ref, no `service_role` and no `rzp_live_`;
- `/admin`, `/counsellor`, `/applications` and `/applications/<random uuid>` redirect to `/login?next=…`, and an unknown page returns 404;
- `/pricing` has no buy control;
- the homepage main DOM, text and 76 internal links hash identically to www.nextwise.world.

Not checked:
- READY status and commit SHA (no Vercel access);
- every signed-in journey (A8).

## 4. Rollback

- **Preview:** delete the deployment or the branch-scoped variables. Production is untouched.
- **QA database:** CC26-02 §4.
- **Code:** `Rollback-CC26.ps1` before committing, or `git revert` after.
