# NW03.3 — Separate Student Product Journeys

**Milestone:** NW03 "Two-Product Architecture"
**Stage:** 3 of 6
**Depends on:** NW03.1, NW03.2

## 1. What was built

Three new, authenticated routes under a new top-level `src/app/studio/` directory, sharing one new root layout (`src/app/studio/layout.tsx`) that renders the existing `DashboardShell` — the fifth independent root layout in this codebase, following the exact precedent already set by `(site)`, `admin`, `dashboard`, and the `profile`/`recommendations` pair (none of which share a single global root layout; see that layout file's own docblock).

- **`/studio`** (`src/app/studio/page.tsx`) — the shared hub. A signed-in student lands here to choose between the two product workspaces. Deliberately thin: no product-specific data, just the choice, framed so neither option reads as a prerequisite for the other.
- **`/studio/career`** (`src/app/studio/career/page.tsx`) — `redirect("/dashboard")`. The Career Intelligence workspace already exists in full at `/dashboard`; this stage reuses it rather than forking or re-skinning it, so there remains exactly one implementation of the Career workspace.
- **`/studio/abroad`** (`src/app/studio/abroad/page.tsx`) — a new, honest foundation page. Links to the real, working `/study-europe` (Country Explorer) and `/courses`, and uses the existing `ComingSoon`/`DemoNotice` primitives to label application tracking and Abroad-specific recommendations as not built yet, rather than fabricating either.

## 2. Routing flow diagram

```
Signed-out visitor
  -> /career or /abroad (public, no auth) -> "Get Started" -> /register?next=/studio/{career|abroad}
       -> RegisterForm success -> getSafeRedirectPath(next, "/welcome") -> lands on /studio/career or /studio/abroad directly
       (no "next": plain /register -> /welcome, exactly as before NW03)
  -> /login?next=/studio/{career|abroad} -> LoginForm success -> getSafeRedirectPath(next, resolveMyDefaultWorkspace()) -> same

Signed-in visitor
  -> /studio (hub) -> choose -> /studio/career (redirects to /dashboard) | /studio/abroad (foundation workspace)
  -> DashboardShell sidebar now also has a "Studio" link (first item) back to the hub from /dashboard, /profile,
     /recommendations, or either /studio/* page
```

## 3. Middleware change

`src/lib/supabase/middleware.ts`'s `PROTECTED_PATHS` gained one entry, `"/studio"`. The existing prefix-match logic (`pathname === p || pathname.startsWith(\`${p}/\`)`) already covers `/studio/career` and `/studio/abroad` from that single entry — no middleware logic was rewritten, only the array extended.

## 4. RegisterForm.tsx fix (AC-04)

Confirmed in NW03.1 (section 5): `RegisterForm.tsx`'s post-signup redirect was hardcoded to `/welcome` regardless of a `?next=` param, which would have forced an Abroad-originated signup through the Career-oriented Assisted Onboarding screen with no way to reach `/studio/abroad` directly.

Fix: a new `safeNext` value, computed once via the existing shared validator — `getSafeRedirectPath(searchParams.get("next"), "/welcome")` — now drives both the `emailRedirectTo` URL (for the email-confirmation path) and the `router.push(...)` call (for the immediate-session path). A plain registration with no `next` param still lands on `/welcome` exactly as before this change; only an explicit, safe `next` (e.g. `/studio/abroad`, arriving from the new `/abroad` page's "Get Started" link) changes the destination. The existing `safeNextForLink` variable (used only for the "Log in" cross-link, with an empty-string fallback) is unchanged.

`src/app/auth/callback/route.ts` already applied `getSafeRedirectPath` to its own `next` param before this stage — no change was needed there.

## 5. Navigation change

`DashboardShell.tsx`'s `NAV_ITEMS` gained one new entry, `{ label: "Studio", href: "/studio", icon: LayoutGrid }`, inserted first (ahead of the pre-existing "Dashboard" item). This link now appears in the sidebar on every page that already uses `DashboardShell` (`/dashboard`, `/profile`, `/recommendations`, and now `/studio`, `/studio/career` [before its redirect fires], `/studio/abroad`), giving a student already inside one workspace a one-click way back to the hub to switch to the other. The existing `isActive()` helper correctly highlights "Studio" as active on `/studio` and any `/studio/*` route, via its pre-existing prefix-match branch.

## 6. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 18 pre-existing warnings (unchanged) |
| `npm run build` | succeeded; `/studio`, `/studio/career`, `/studio/abroad` all appear as new dynamic (`ƒ`, correctly reflecting their auth-gated status) routes |
| `npx vitest run` | 127 test files, 2091 tests, all passed — no regression from the `DashboardShell`, `RegisterForm`, or `middleware` edits |

## 7. AC-04 status

Abroad is now reachable end-to-end — `/abroad` (public) → register/login with `next=/studio/abroad` → `/studio/abroad` — without the visitor ever being routed through `/welcome`, `/career-discovery`, or any Career-assessment screen. Career is unaffected: a plain signup/login with no `next` param behaves exactly as it did before this milestone.

## 8. What NW03.3 explicitly did not do

- Did not modify `/welcome`'s own content or choices (still Career-shaped) — bypassed for Abroad signups rather than rewritten, per the audit's R-2 reasoning, to avoid regressing M11-B behavior for Career signups.
- Did not fork, rewrite, or duplicate `/dashboard`'s Career workspace.
- Did not fabricate any Abroad-side progress, application, or recommendation data — `/studio/abroad` uses only `ComingSoon`/`DemoNotice` for the not-yet-built parts.
- Did not build the entitlement module (NW03.4) — the hub page does not yet read `pricing_purchases`.
