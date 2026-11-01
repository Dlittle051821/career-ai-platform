# NW08.7 · 05 · Files added and dependencies

## Dependencies

**No new dependencies.** The prototypes use only what `C:\carrier.ai` already has installed:

| Package | Version | Use |
|---|---|---|
| `motion` | 14.9.0 (re-exports `framer-motion` 14.9.0) | `useScroll`, `useSpring`, `useTransform`, `useMotionValue`, `useMotionValueEvent`, `motion.*` elements |
| `next` | 16 (existing) | App Router pages, `next/image`, `next/link`, `notFound()` |
| `react` | 19 (existing) | `useSyncExternalStore` for the media-query hooks |
| Tailwind CSS | v4 (existing) | All styling |

`package.json` and `package-lock.json` are **not modified** by this milestone. No Three.js, React Three Fiber, GSAP, Lottie or similar library is used, and a test enforces this.

## Files added (all new)

### Routes: `src/app/motion-lab/`
| File | Purpose |
|---|---|
| `layout.tsx` | Root layout for the lab: fonts, global CSS, `noindex, nofollow, nocache` |
| `not-found.tsx` | 404 shown in production |
| `page.tsx` | `/motion-lab` comparison gallery |
| `living-path/page.tsx` | Concept A |
| `unfolding-future/page.tsx` | Concept B |
| `window-to-tomorrow/page.tsx` | Concept C |

### Components: `src/components/motion-lab/`
| File | Purpose |
|---|---|
| `ScrollStory.tsx` | Sticky scroll stage, progress, reduced-motion switch, skip link |
| `StoryCaptions.tsx` | The four story captions |
| `DevScrubber.tsx` | Development scrubber: restart, stage jumps, progress slider |
| `StaticStory.tsx` | Reduced-motion layout |
| `PathsAhead.tsx` | Always-visible entry points under each story |
| `LabChrome.tsx` | Lab header with the existing `Logo` and `MAIN_NAV` |
| `ObjectFrame.tsx` | Aspect-safe frame for the concept object |
| `use-prefers-reduced-motion.ts` | `usePrefersReducedMotion`, `useIsWide` |
| `concepts/LivingPath.tsx` | Concept A |
| `concepts/UnfoldingFuture.tsx` | Concept B |
| `concepts/WindowToTomorrow.tsx` | Concept C |

### Logic and tests: `src/lib/motion-lab/`
| File | Purpose |
|---|---|
| `guard.ts` | `isMotionLabEnabled()`: the production guard |
| `story.ts` | Stages and pure motion maths |
| `content.ts` | Real labels and links; concept catalogue |
| `living-path-geometry.ts` | Concept A curves and timeline |
| `unfolding-geometry.ts` | Concept B fold angles, windows and timeline |
| `window-geometry.ts` | Concept C timeline and beam stagger |
| `motion-lab.test.ts` | 61 tests: route protection, navigation and content preservation, story maths, choreography data, reduced-motion and performance audits |

### Documentation: `docs/milestones/NW08.7/`
The `NW087_*.md` files and `evidence/` (captured frames, contact sheets, videos, `qa-results.json`).

## Files modified

| File | Change |
|---|---|
| `vitest.config.mts` | One include entry added: `"src/lib/motion-lab/**/*.test.ts"` (with a comment). Required because the project uses an explicit include list. |

## Files not touched

Homepage (`src/app/(site)/page.tsx`) and all homepage components, `Header`, `MobileNav`, `RegistrationPrompt`, `src/config/site.ts`, sitemap, robots, middleware, Supabase code and migrations, pricing, payments, entitlements, authentication, `package.json` and the lockfile. Nothing was committed, pushed or deployed.
