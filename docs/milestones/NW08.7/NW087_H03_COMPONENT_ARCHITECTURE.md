# NW08.7 · H03 · Component architecture

## Files

### New: components (`src/components/sections/home/signature/`)
| File | Responsibility |
|---|---|
| `SignatureHero.tsx` | **Motion controller.** Section and sticky stage. Scroll progress via `useScroll` and `useSpring`; the reduced-motion switch (`useReducedMotion`); the one-off opening line draw; the camera settle; the registration-prompt hold. Also contains the scene-6 continuation thread. |
| `SignatureRibbonArt.tsx` | **Ribbon renderer and image-mask composition** for one layout. One SVG holds the ground shadow, the back half of the loop, the photographs clipped to the loop (with sweep transitions and drift), the front ribbon's shadow on the photo, the front ribbon with its edge highlight, and the pathway nodes. Wide-layout pathway labels sit in the same coordinates. `CompactPathways` is the phone pathway strip. |
| `SignatureHeroCopy.tsx` | **Scene content and entry actions.** Headline, promise, the two actions. Server-renderable; no client JavaScript needed to read or use it. |
| `SignatureHeroDevBar.tsx` | Preview-only inspection bar: restart, jump to scenes 1–6, scrub. Only `/homepage-preview` renders it. |
| `fonts.ts` | Fraunces italic via `next/font`, loaded only by this hero |
| `signature-hero.css` | The CSS opening reveal and its reduced-motion override |

### New: pure logic (`src/lib/home/signature-hero/`)
| File | Responsibility |
|---|---|
| `geometry.ts` | **Ribbon geometry.** Spline, arc-length resampling, width and twist profiles, 3D-twist shading, quads, reveal paths, the photographic lobe, and image cover and focal placement. |
| `layouts.ts` | **Responsive configuration.** The wide (≥1024px) and compact compositions, waypoints and portrait target. |
| `timeline.ts` | **Scene choreography.** Scenes, timeline windows, reveal mapping, scene lookup. |
| `content.ts` | Copy, actions, pathways (derived from `MAIN_NAV`) and photograph metadata |
| `variant.ts` | The homepage switch (`NEXTWISE_HOMEPAGE_HERO`) and the preview guard |
| `signature-hero.test.ts` | 49 tests (see H10) |

### New: route
`src/app/(site)/homepage-preview/page.tsx`. The full homepage with the signature hero and the dev bar. 404 outside development and test; `noindex, nofollow`.

### Modified (small, additive)
| File | Change |
|---|---|
| `src/app/(site)/page.tsx` | Imports `SignatureHero` and `getHomepageHeroVariant`, and renders `{heroVariant === "signature" ? <SignatureHero /> : <HomeHero />}`. Everything else (metadata, section order, comments) is unchanged. |
| `src/lib/registration-prompt/event-bus.ts` | Adds `REGISTRATION_PROMPT_HOLD_EVENT`, `setRegistrationPromptHold()` and the pure `applyRegistrationPromptHold()` reducer |
| `src/components/registration-prompt/RegistrationPrompt.tsx` | Tracks active holds from mount. The timed path waits while any hold is raised. Contextual requests and every eligibility rule are unchanged. |

Not touched: `HomeHero.tsx`, all other homepage sections, `Header`, `MobileNav`, `Footer`, `Logo`, `site.ts`, `globals.css`, `fonts.ts`, `next.config.ts`, `package.json` and the lockfile, the sitemap and robots, middleware, Supabase, and all business logic.

## Data flow

```
window scroll ──► useScroll(section, ["start 64px","end end"]) ──► useSpring ──► progress (MotionValue 0–1)
                                                                                  │
                     timeline.ts (pure)  ◄─────────── useTransform(progress, …) ◄─┘
                         │
     ┌───────────────────┼───────────────────────────────┬──────────────────────────┐
     ▼                   ▼                               ▼                          ▼
 mask pathLength    sweep translate x/y          image scale / pan x          opacity / visibility
 (front, back)      (outer +, inner −)           (drift, campus pan)          (shadows, nodes, labels)
```

React renders the hero once. Each frame is motion values writing SVG attributes and CSS transforms and opacity directly. There are two exceptions, and neither happens per frame: one `useState` flips once to start loading the campus photo when the story nears it, and one `useSyncExternalStore` reads which layout is on screen and changes only at the 1024px breakpoint.

## Why SVG, not WebGL (brief §06)

The ribbon's depth comes from geometry and lighting, not from a renderer. `geometry.ts` treats the ribbon as a strip whose width vector rotates out of the screen plane by a twist angle. For about 220–260 slices it computes:
- the projected width, which narrows into folds and pinches where the ribbon turns;
- the surface normal;
- Lambert diffuse plus Blinn-Phong specular shading from an upper-left light;
- which side faces the viewer: top surface in the logo's cyan-to-navy, underside in navy.

This is computed once per layout at module load and drawn as static SVG paths. That gives real-looking folds, overlap (the loop passing behind itself), self-shadowing and edge highlights at the cost of one SVG.

WebGL or React Three Fiber would add a large dependency, a canvas without the crisp vector edges, a GPU warm-up on low-end phones, and a separate accessibility story. It would buy nothing this composition needs, so it was not added. No dependency was added at all.

## Why SVG `<image>` for photographs

The photographs must be clipped to the ribbon's loop and moved in the ribbon's coordinate space. `next/image` renders an HTML `<img>`, which cannot take part in an SVG clip, and HTML `clip-path: url(#svg)` is unreliable in Safari. The hero therefore uses `getImageProps()` from `next/image` to get the **optimised** `/_next/image` URL (resized, WebP, quality 75 as configured) and draws it with SVG `<image>`. Only the layout on screen fetches photos, and the second photo is fetched only when the story approaches it.
