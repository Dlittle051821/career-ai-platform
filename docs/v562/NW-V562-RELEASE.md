# NW-V5.6.2 — Two Pathways ("Where are you in your journey?"), production release

Approved 13 Nov 2026 (object-only design: Dreamscape Binoculars · Journey Ticket). This release replaces
scene 2 of the V5.4 homepage ("One platform, two pathways") with the approved V5.6.2 scene. Nothing
else on the site changes.

## What changed

| File | Change |
|---|---|
| `src/components/sections/home/v54/NextwiseV54Home.tsx` | Scene 2 renders `v562/TwoPathways` in backdrop panel 1; the stage keeps an empty scene slot labelled by the new title. Unused V4 pathway photo imports removed. |
| `src/components/sections/home/v562/TwoPathways.tsx` | Server-rendered scene: copy, real links, decorative objects (`aria-hidden`). |
| `src/components/sections/home/v562/TwoPathwaysMotion.tsx` | Client starter: runs the controller when the browser is idle or the story starts moving; opens destinations through the app router. |
| `src/components/sections/home/v562/two-pathways.css` | Scoped styles (`.tp562`), container-unit scaling, stacked phone layout, the N fade, the coral overlay. |
| `src/lib/home/v562/content.ts` | Copy, routes and the prototype's motion tables (pure functions). |
| `src/lib/home/v562/two-pathways.ts` | Controller: one `split` value drives every visual; reads V5.4's chapter attributes only. |
| `src/lib/home/v562/route-transition.ts` | Electric Coral transition into the real route (self-cleaning overlay on `<body>`). |
| `src/lib/home/v562/v562.test.ts` | 28 tests: routes, markup, a11y, assets, motion tables, integration guards. |
| `src/components/sections/cc24-v54-baseline-hashes.json` + guard test | `NextwiseV54Home.tsx` re-pinned (the only homepage file that changes); docblock records why. |
| `public/home-v562/` | Binoculars render (AVIF + WebP, 480–2332 w) and two vector backgrounds. |

Unchanged: the hero and the original N animation, the header, the V5.4 engine/chapters/backdrop,
`v54.css`, every other scene, all routes, data, Supabase, auth, payments and dependencies.

## Behaviour

- **Navigation:** V5.4's one-gesture chapter controller stays the only scroll authority. The scene plays the
  approved entrance when arriving from the hero, is already settled when arriving from below, and resets when
  leaving. The travelling N arrives as before, fades while this chapter is on screen, and returns with the
  next move.
- **Discovery** → `/career-discovery`. **Clarity** → `/courses` (Course Explorer, real data). On activation the
  ticket route completes, the coral circle covers the screen, the real route opens underneath and the coral
  lifts once it has rendered. Later uses in a session are shorter; reduced motion navigates directly;
  Ctrl/Cmd-click opens a new tab.
- **Desktop:** hover/focus = activate (split 0.64 / 0.36), click = detail view (0.93 / 0.07), Escape or
  "Both pathways" returns. **Phones/portrait:** stacked; tap activates; the collapsed pathway's button
  is not hittable.
- **Performance:** fields move by `clip-path` and transforms (no layout during motion); memoised style
  writes; ambient lens drift runs only while the scene is on screen, drops to 30 fps after 6 s without
  input and rests after 30 s; adaptive low-effects mode on slow devices; nothing runs while hidden.

## Asset provenance

| Asset | Source | Licence |
|---|---|---|
| `binoculars-*.avif/webp` | Original three.js render, `docs/v562/source/binoculars-render.html` (procedural geometry, no external models or textures), master 2332 × 1265, lens geometry in `binoculars-master.lens.json` | Original work for Nextwise |
| Lens scenes, trails, chips, route cards, ticket | Hand-written SVG/HTML in `TwoPathways.tsx` | Original work for Nextwise |
| `contours.svg` | Procedural contour lines | Original work for Nextwise |
| `europe.svg` | Natural Earth via world-atlas | Public domain |

No people, faces, silhouettes, stock or AI-generated images.

## Rollback

- **Vercel:** Instant Rollback (or Promote) to the previous production deployment.
- **Git:** `git revert <V5.6.2 commit>` on the release branch restores the V5.4 scene exactly (the guard test's
  original hash comes back with it).
