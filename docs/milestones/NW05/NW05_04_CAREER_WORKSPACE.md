# NW05.4 — Career Workspace (`/studio/career`)

Status: **COMPLETE** (confirmation + documentation; no code change needed)

## 1. Decision carried over from NW05.1's audit

`/studio/career` already satisfies this stage's requirements via its NW03.3 redirect to `/dashboard` — the existing, fully real, already-tested Career Workspace. NW05.4 does not fork or rebuild it: doing so would create exactly the "second, drifting copy" risk NW03.3's own docblock (`src/app/studio/career/page.tsx`) explicitly warns against, and which this brief's own "do not overengineer" instruction argues against. NW05.2 (the enriched `/studio` hub) and NW05.4 (this stage) deliberately complement `/dashboard` rather than duplicate it — see `NW05_02_STUDENT_STUDIO.md` §3 for why the hub's own overview is intentionally lighter and cross-product rather than a second Career funnel view.

## 2. Mapping the brief's suggested sections to what's real

| Brief's suggested Career Workspace element | What's real today, and where |
|---|---|
| Hero | `/dashboard`'s greeting header (real first name, real time-of-day greeting) |
| Student Career Progress (no invented completion %) | `JourneyTracker` + `computeJourneyProgress()` — every stage honestly derived from real data (see that module's own extensive docblock) |
| Saved Career Interests | `SavedShortlistCard` — real `listSavedItems()` result |
| Career/Course/University Discovery | Existing, fully working explorers: `/careers`, `/courses`, `/universities` |
| Recommendations (eligibility/verification gates preserved) | `RecommendedForYou` + `getMyRecommendationReadiness()` — readiness and verification state are read-only from the student's side, server-derived, never student-settable (confirmed secure in NW05.1's audit) |
| Career Pathway | No dedicated "pathway" tool exists in this codebase today (confirmed by search — only marketing copy mentions the word). Per the brief's own instruction ("display a truthful foundation rather than a fake tool"), `JourneyTracker`'s real Explore→Apply stage map already serves as that truthful foundation; no new placeholder tool was built to simulate one that doesn't exist. |
| Guidance Entry | `DiscoverySessionCard`, linking to the real `/discovery-session/book` flow |

## 3. On "suggested tabs"

The brief's Overview/Careers/Courses/Universities/My Pathway tab suggestion is explicitly non-binding ("suggested tabs... only expose tabs that connect to real functionality"). `/dashboard` already exposes equivalent, real navigation through `DashboardShell`'s sidebar (`Dashboard`, `My Profile`, `Recommendations`, `Saved`, `Applications`, `Discovery Session`, `Documents & Payments`), which every page in this product family already shares. Adding a second, parallel tab bar on top of that sidebar for `/studio/career` specifically would be redundant navigation, not "exposing real functionality that isn't exposed yet" — so none was added.

## 4. "The Career Workspace must not require Abroad activation"

Unchanged and already true: `/studio/career` → `/dashboard` has never had any dependency on `/studio/abroad` or on Abroad entitlement — confirmed again in this stage, no code path added.

## 5. Validation

No code changed in this stage, so the full validation gate (`tsc`/`lint`/`vitest`/`build`) run for NW05.2/NW05.3 already covers this stage's baseline. No new defect found.
