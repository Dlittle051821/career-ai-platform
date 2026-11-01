# NW08.7 · H13 · Signature motion homepage: completion report

**Status:** implemented, tested and ready for your local review. **Off by default.** Nothing is committed, pushed or deployed. No environment variable, migration or business logic was changed.

## How to view it (Windows, `C:\carrier.ai`)

```powershell
cd C:\carrier.ai
npm run dev
```

| Open | You see |
|---|---|
| http://localhost:3000/ | The current homepage, unchanged |
| http://localhost:3000/homepage-preview | The same homepage with the signature hero, plus a "Hero preview" bar (restart, scenes 1–6, scrub). Development only. |

For side-by-side comparison, open both in two windows.

- **Reduced motion:** Windows Settings → Accessibility → Visual effects → Animation effects **Off** (or Chrome DevTools → Rendering → `prefers-reduced-motion: reduce`).
- **On a phone:** run `npm run dev -- -H 0.0.0.0` and open `http://<your PC's LAN IP>:3000/homepage-preview`.

**To see it as the real homepage locally**, add `NEXTWISE_HOMEPAGE_HERO=signature` to your **local** `.env.local`, then `npm run build` and `npm run start`. `/` will then render the signature hero. Remove the line to go back. Do not set it in Vercel until you approve publication.

## Definition of done (brief §18)

| Criterion | Status |
|---|---|
| Approved design implemented in real Next.js components | **Done**: `SignatureHero`, `SignatureRibbonArt`, `SignatureHeroCopy` and supporting modules |
| Original logo preserved | **Done**: untouched, rendered only by the existing header; a test enforces this |
| N-inspired ribbon with convincing depth | **Done**: 3D-twist shading, folds, underside, overlap (passes behind itself), self-shadow, edge highlight. Judged from browser captures; *real-device viewing pending.* |
| Ribbon animates smoothly with scroll | **Done in headless Chromium.** Phones: 0 slow frames. 1440: 6 slow frames under CPU-only compositing. *Real-device check pending.* |
| Photography genuinely integrated inside the ribbon | **Done**: clipped to the loop, with the back of the loop behind and the front over the image edge |
| Elegant, reversible image transitions | **Done**: curved sweep edges plus a spatial pan. Reversibility verified (pixel comparison and tests). |
| Story moves through the planned scenes | **Done**: six scenes (H02) |
| Final scene connects to functioning tools | **Done**: Career Intelligence `/career`, Study Abroad `/abroad`, then the thread into "Choose where to start" |
| Genuinely responsive | **Done**: two compositions; verified at 375 / 390 / 768 / 1024 / 1280 / 1440 |
| Polished reduced-motion alternative | **Done**: the finished composition, static, verified |
| Existing navigation preserved | **Done**: six items unchanged; header, account and workspace behaviour untouched |
| Business functionality unaffected | **Done**: no backend or data changes. The registration prompt gained one additive hold check. |
| Automated tests pass | **Done**: 2,518 / 2,518 |
| Production build passes locally | **Done**: both the default and the opted-in build |
| Visual browser inspection documented | **Done**, headless Chromium (H10); *Safari, Firefox and real devices not tested* |
| Safe rollback available | **Done** (H12) |
| Ready for review | **Yes** |

## Results in brief

- **Lighthouse** (single local runs, production build, signature vs current homepage): mobile performance 64 vs 59, mobile LCP 6.3 s vs 33.1 s; desktop performance 98 vs 76, desktop LCP 1.1 s vs 6.1 s; CLS 0 to 0.004 on both. Accessibility, best practices and SEO are unchanged (findings are in existing sections). Details in H08.
- **New payload:** two WebP photographs (about 75–83 KB each on wide screens, 46–52 KB on phones), the second fetched only when the story reaches it. One italic font file. No new npm dependencies.

## What needs your decision

1. **Photography.** The portrait is the site's existing generated image. Commission or license editorial photography before launch (H04); dropping it in needs no code change.
2. **The current hero's career search box** is not in the approved reference, so the signature hero omits it (H09). Keep it out, or add it under the actions?
3. **Real-device review** on an iPhone and a mid-range Android phone (H11).
4. **Publication:** when approved, set `NEXTWISE_HOMEPAGE_HERO=signature` in the production build environment and redeploy, or make the signature hero the default in `page.tsx`. Both need your go-ahead.
5. **Committing:** these files are uncommitted on `release/m10`.

## Documents

H01 specification · H02 storyboard · H03 component architecture · H04 assets and licensing · H05 timing and scroll mapping · H06 responsive notes · H07 accessibility and reduced motion · H08 performance · H09 before/after · H10 tests and build · H11 known limitations · H12 rollback · H13 this report. Evidence: `evidence/homepage/`.
