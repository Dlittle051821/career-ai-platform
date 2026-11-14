# Nextwise — approved baseline (read this first, in every chat)

> **Canonical UI/UX baseline: V5.6.3.** The founder selected it on 14 Nov 2026: tag
> `nextwise-ui-v563-approved`, commit `893d816`. It supersedes the visual baselines below wherever
> they conflict. Read `docs/UI-UX-CANONICAL-BASELINE.md`, `docs/UI-UX-DEVELOPMENT-PROTOCOL.md` and
> `docs/UI-UX-REFERENCE-REGISTER.md` before any UI work, and run `npm run verify:baseline`.
> The security, legal and release work on `release/v563-production` (`e37220f`) is a separate,
> approved-for-release-gating descendant. It keeps every locked V5.6.3 file unchanged.


Nextwise is developed in several parallel chats. To keep one chat from undoing what another has already
built and the owner has approved, every piece of work follows three rules.

## 1. Start from the approved tip, never from an older commit or from production

| | |
|---|---|
| Approved tip | tag `nextwise-ui-v563-approved` (`893d816`, branch `feature/v563-career-intelligence-refinement`); before 14 Nov 2026 it was `release/v5-6-2-on-approved` / `preview/v562-approved` (`3f8c59d`) |
| Built on | `ciux/01b-header-hero` @ `64af0a7` |
| Live production | an older CC-24…CC-26 commit; it is **not** the base for new work |

New work = a new branch from the approved tip. When the owner approves it, it becomes the new approved tip
and this file is updated in the same commit.

## 2. What is approved (and locked by tests)

Locked in `src/config/approved-baseline.test.ts` plus the CC-24/CIUX hash pins in
`src/components/sections/cc24-*`:

| Approved | Commit | Lock |
|---|---|---|
| CC-22B…CC-26 platform, security and student journeys | `5756ef3`…`8659828` | existing test suites |
| CIUX-01: design tokens, buttons, navigation groups, contact single source | `b15c162` | approved-baseline + CIUX tests |
| CIUX-01B: one global `SiteHeader` and one `PageHero` | `7c0ee24` | approved-baseline + hash pins |
| CIUX-01B Home: **Home is the first header item and first phone-menu item** | `64af0a7` | approved-baseline |
| V5.4 homepage, hero and the original N animation | `255336d` | CC-24 hash pins |
| V5.6.2 Two Pathways (Dreamscape Binoculars, Journey Ticket, coral transition) | `3f8c59d` | approved-baseline + `src/lib/home/v562/v562.test.ts` |
| **V5.6.3 canonical UI/UX baseline**: Master Logo v2 (pink arrow), Career Intelligence (Robotics, Climate & Energy, Space Systems tabs), N alignment, account symbol | `893d816` (tag `nextwise-ui-v563-approved`) | `src/config/ui-baseline/` (238 locked files, 94 tokens) + `tests/visual/` (30 reference images) |

## 3. Every package is checked before it installs

- An install script refuses to run unless the target already contains the approved tip.
- After installing, it runs the full test suite. If a lock test fails, the change has undone an approved
  decision: fix the change, or get the owner's approval and update the lock and this file together.

## Not yet approved (kept out of the approved tip)

- Career Explorer V1 (`feature/career-explorer-v1`, local only)
- V5.5.x homepage preview routes (uncommitted on the PC)
- CC-26 QA migrations, payments, live AI
