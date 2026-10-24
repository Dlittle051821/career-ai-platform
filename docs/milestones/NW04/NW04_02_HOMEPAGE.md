# NW04.2 — Premium Homepage

Status: **COMPLETE**

## 1. What changed

Two new, additive sections were added to `src/app/(site)/page.tsx`, inserted directly beneath `HomeHero` and above `DiscoveryPillars`:

```
HomeHero → ProductEntryCards (new) → StudioIntro (new) → DiscoveryPillars → TrustedStudyExplorer → HowItWorks → WhyNextwise → HomeFinalCTA
```

`HomeHero.tsx` itself, and every other pre-existing section, is byte-for-byte unchanged — see `NW04_01_UX_AUDIT.md` §1 for why.

### 1.1 `ProductEntryCards.tsx` (new)

The "two equal product entry points" surface (AC-01, AC-02). Two cards, equal visual weight, same card component, same width: Career Intelligence (`/career`) and Nextwise Abroad (`/abroad`), each with its own icon, one-line description, and a `LinkButton` CTA. Uses the existing `FADE_UP_CLASSES`/`getStaggerDelayMs()` motion system (CSS-only, `motion-reduce:` variants included) and the shared `HOMEPAGE_CONTAINER_CLASSNAME` layout width, so it visually matches the rest of the homepage's rhythm rather than introducing a new one. A footer link ("Not sure yet? See how Nextwise works" → `/how-it-works`) gives a non-committal third option for an undecided visitor.

### 1.2 `StudioIntro.tsx` (new)

The "Student Studio" introduction (part of AC-01). Two-column layout: left side explains the one-account/two-workspace model with a short checklist and a `LinkButton` to `/register?next=/studio` ("Create Your Free Account" — exercising the existing `getSafeRedirectPath` safe-redirect flow, not a new one); right side is an illustrative Studio preview on the brand-navy field, showing two generic workspace tiles (Career / Abroad) with no name and no counts, plus an explicit "Illustrative preview" caption. See `NW04_01_UX_AUDIT.md` §2 for the anti-fabrication reasoning behind that caption.

## 2. Verification

- `npx tsc --noEmit` — clean after both sections were added and wired in.
- `npx vitest run src/lib/home` — 88/88 passed, confirming the new sections are invisible to `homepage-source-audit.test.ts`'s `SECTION_FILES` allowlist (by design — see audit §1) and that nothing about `HomeHero.tsx` or the other five pre-existing sections regressed.
- Full-suite re-verification happened later in NW04.5/NW04.7 (2115/2115 passing) and again covers these files.

## 3. Acceptance criteria addressed

- **AC-01** — premium homepage with a genuine Student Studio introduction, built from real, truthful copy (no fabricated student data).
- **AC-02** — Career Intelligence and Nextwise Abroad given equal, side-by-side billing as the two product entry points, immediately below the hero.
