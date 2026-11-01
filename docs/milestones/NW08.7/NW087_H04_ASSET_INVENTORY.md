# NW08.7 · H04 · Asset inventory and licensing notes

## Photographs used

| Asset | Size | Used for | Provenance (from the repository's own records) | Where else it is already live |
|---|---|---|---|---|
| `public/hero/nextwise-student-hero.png` | 900×1125 | Scene 3, "ambition" portrait | Recorded in `HomeHero.tsx` (UX10-H05B notes) as the **generated** "aspirational student" image supplied in milestone UX10-H02. It is illustrative and not a photograph of a real person. | Previously the homepage hero portrait; the transparent cut-out of the same image (`nextwise-student-cutout.png`) is live in `HomeHero`, `CareersHero` and `EuropeExplorerHero` |
| `public/hero/campus-sky-backdrop.png` | 1672×941 | Scene 4, campus and city pan | Supplied with UX10-H05B as a "real, usable" asset, per `HomeHero.tsx` | `HomeHero`, `CareersHero`, `EuropeExplorerHero`, `ProfileWorkspace` |

Both are **repository-approved**: they were supplied for, and are already published on, the live site. Neither is new to this milestone, and no image was generated, downloaded or licensed for NW08.7.

Every photograph's text alternative begins "Illustrative image:". Nothing on the page presents either image as a real Nextwise student, a real outcome or a specific real university.

## Considered and not used

| Asset | Why not |
|---|---|
| `public/cta/final-cta-vista.png` | It has handwritten text ("A brighter tomorrow starts today") baked into the image, which a mask would clip mid-word. Its saturated sunset grade also conflicts with the light palette and the brief's "no glowing fantasy scenery". |
| `public/hero/nextwise-student-cutout.png` | Transparent cut-out; the loop needs a full-bleed photograph |

## Missing assets (recommended before public launch)

The brief asks for editorial, natural photography of young adults planning their future, real educational environments and aspirational European campuses, and warns against artificial faces.

**The portrait currently used is a generated image.** It is the same image the site already uses, but it does not fully meet that bar. I recommend commissioning or licensing:

1. Two or three editorial portraits of real students (with model releases), photographed in natural light. Portrait orientation, at least 1800 px tall, with the face in the upper third.
2. One or two European campus or architecture photographs, licensed for web use, at least 2400 px wide, with an open sky in the upper half (the loop's crop favours it).

The component needs no code change to swap photographs. Update `PHOTOGRAPHS` in `src/lib/home/signature-hero/content.ts` (`src`, `size`, `focal`, `face`, `alt`). The test suite then re-checks automatically that the new face is never cut by the ribbon and that the image covers the loop.

## Logo and fonts

- The official logo is untouched. It renders only through the existing `Logo` component in the header, and a test asserts that the hero never references `nextwise-logo*` or `nextwise-icon*`. The ribbon takes its colours from the logo's N-arrow but is a separate, original illustration, not a substitute mark.
- Fraunces (upright and italic) and Plus Jakarta Sans are both SIL Open Font License, served by `next/font`.
- Icons are `lucide-react` (ISC), already a dependency.
