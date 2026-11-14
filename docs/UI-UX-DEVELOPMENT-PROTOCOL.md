# NEXTWISE UI/UX development protocol

**One approved visual baseline. Many independent design branches. One controlled integration release.**

The baseline is in `docs/UI-UX-CANONICAL-BASELINE.md` (tag `nextwise-ui-v563-approved`, commit `893d816`).
Every Claude Code chat and every developer follows this file.

## 1. Before starting any UX task

1. `git fetch --tags origin`.
2. Choose the base. It is either:
   - the tag `nextwise-ui-v563-approved`; or
   - an **explicitly approved integration baseline** that contains it. Check with
     `git merge-base --is-ancestor nextwise-ui-v563-approved <base>`.

   Never use as a base:
   - live production (`a1017b9`);
   - `main`;
   - `release/m10`;
   - `3f8c59d` or anything older;
   - `C:\carrier.ai`.
3. Read `docs/UI-UX-REFERENCE-REGISTER.md` for the page you will touch.

## 2. Page task template (copy into the task's first message or report)

```
Task:            <page name> — <one-line goal>
Branch:          ux/<page>-<yyyymmdd>-<slug>        (unique; never reused)
Worktree:        C:\ClaudeBuilds\UX-<PAGE>-<SLUG>   (isolated: git worktree add)
Starting commit: <full SHA of the base>; contains nextwise-ui-v563-approved: yes
Route(s):        /<route>[, ...]
Allowed files:   <explicit list or globs, e.g. src/app/(site)/<route>/**, src/components/sections/<route>/**>
Forbidden:       shared header, footer, logo/brand assets, homepage (src/components/sections/home/**),
                 design tokens, other pages, middleware/auth/payments/AI, supabase/**
Shared UI reuse: SiteHeader, PageHero, NAV config (src/config/site.ts), tokens, MASTER_LOGO
Backend needs:   none | <describe; triggers the separate backend review in §5>
```

## 3. Rules while working

1. Create the branch in its own worktree. Record the starting commit in the report.
2. Change only the allowed files. Leave unrelated pages alone, and don't "tidy" shared files.
3. Reuse the central navigation (`src/config/site.ts`), branding (`MASTER_LOGO`), the design
   tokens, `SiteHeader` and `PageHero`. Don't copy them into the page.
4. Don't recreate the N animation, logo or animation assets. Don't edit
   `src/config/ui-baseline/v563-manifest.json` or `tests/visual/__baseline__/`.
5. Don't merge or cherry-pick other feature branches into yours. Independent branches stay
   independent until integration (§7).
6. Don't rebase or force-push shared branches. Don't delete earlier branches, packages or worktrees.
7. Never push or merge into `release/m10`. It is the Vercel **Production** branch: a push there
   deploys and assigns www.nextwise.world immediately.
8. Don't change the public domain, Vercel settings, environment variables or any database.

## 4. Required checks before the task is reported done

| Check | Command | Must be |
|---|---|---|
| Baseline lock | `npm run verify:baseline` | pass (no locked file, token, nav item, route or contact changed) |
| Full unit suite | `npm test` | pass |
| Types, lint | `npm run typecheck`, `npm run lint` | 0 errors |
| Visual regression of the shared UI | `npm run build && npm run verify:visual` (Linux or CI) | pass, **without** `--update-snapshots` |
| The page's own checks | accessibility (axe, WCAG 2.2 AA), responsive 360/390/768/1024/1440, keyboard, reduced motion | 0 violations, no horizontal overflow |
| Build | `npm run build` | pass |

**If `verify:baseline` or `verify:visual` fails, the branch has changed approved shared UI.**
Fix the branch. Do not update the manifest or the reference images to make it pass.

## 5. Backend and database work

A schema, migration, RLS, RPC, authorization or auth change is **not** a UX change. It needs its
own:
- schema review;
- migration with rollback;
- authorization tests;
- rollout plan.

It also needs a QA run first and separate owner approval. A UX branch that needs one stops and
reports it.

## 6. Changing the baseline itself (owner approval only)

Only when the owner explicitly approves a change to shared UI, branding or the homepage:

1. Make the change on its own branch, with before and after screenshots and video.
2. Get the owner's written approval.
3. In the same commit:
   - run `node scripts/baseline/ui-baseline.mjs --write --approved-by "<owner>" --reason "<decision>"`.
     This appends to the manifest history; it never replaces it.
   - refresh the affected reference images with `npx playwright test -c playwright.visual.config.ts
     --update-snapshots`, in Linux;
   - update `docs/UI-UX-CANONICAL-BASELINE.md` §5 and the reference register.
4. After it is merged into the integration baseline, create a **new** annotated tag
   (`nextwise-ui-v5XX-approved`). Never move an existing baseline tag.

## 7. Integration (one controlled release)

1. Integrate only page designs that have been approved, and only after all the planned ones are approved.
2. Create one integration branch, `integration/<release>-<yyyymmdd>`, from the frozen baseline or
   the latest approved security-patched descendant (today: `release/v563-production` @ `e37220f`).
3. Bring pages in **one at a time**, with `git cherry-pick -x` or a selective merge. Read each
   branch's dependencies first, from its report's "Integration dependencies".
4. Resolve shared-component conflicts by hand, using `docs/UI-UX-CANONICAL-BASELINE.md`. The most
   recently merged branch never wins automatically.
5. After **each** page, run:
   - the full unit tests;
   - the route and navigation tests;
   - `verify:baseline` and `verify:visual`;
   - the authentication tests where relevant;
   - accessibility and responsive checks;
   - the security regression tests (`src/lib/launch`, `scripts/security` where a DB is available);
   - `npm run build`.
6. Produce one release candidate and its report for the owner's approval.

## 8. Publishing

- A successful Preview deployment is **not** a production release.
- Production is a fresh production-configured build of the approved release commit, staged with
  `vercel deploy --prod --skip-domain`.
- Only after security, legal, functional and visual acceptance is it promoted by hand with
  `vercel promote`. Record the release SHA and the rollback target.
- Incomplete page UX is never published to the public domain.

## 9. What every task delivers

- **Implementation package:** a git bundle, or a branch pushed only when the owner asks; an
  install script that refuses unless the target contains `nextwise-ui-v563-approved`; and a
  rollback.
- **Reference video** (1440 and 390) and desktop and phone screenshots of each changed route.
- **Report** containing:
  - the exact commit;
  - the starting commit;
  - the affected routes;
  - the files changed (inside the allowed scope);
  - the check results;
  - the integration dependencies;
  - open questions.
- **A register update proposal:** a new row for `docs/UI-UX-REFERENCE-REGISTER.md`, marked
  "Proposed". It becomes "Approved" only when the owner approves it.
- The task stops there. It does not touch the public production domain.
