# Germany institution import — audit

Files: `supabase/migrations-proposed/UNI_V3/germany-import/`

| File | What it is |
|---|---|
| `universities-germany.csv` | 239 rows in the column layout of the existing education import. Every row is a draft with verification status "needs review". |
| `universities-germany-audit.csv` | All 274 institutions in the source workbook with the decision for each and the evidence columns. |
| `germany-enrichment-proposed.sql` | Sourced highlights, RWTH subject rankings and 13 photographs. Updates by slug; publishes nothing. |
| `media-audit.json` | Each photograph: file, author, licence, Commons source page, licence status. |

## Source

The Nextwise Germany research workbook (PROGRAMME MASTER and institution sheets). Each institution row carries its
official website, the state ministry page that lists it, its official programme catalogue and a verification date
(27 Oct – 11 Nov 2026). Nothing was added from memory.

## Decisions

- 274 institutions in the workbook, all state (public) institutions. **239 included, 35 excluded.** Excluded:
  institutions with a restricted or public-service admission route (police, administration, justice, dual
  employer-contract study) that a general applicant cannot apply to. The reason is in the audit file per row.
- Categories: 88 universities, 103 universities of applied sciences (Hochschule), 47 art and music universities,
  1 dual university. Mapped from the workbook category; the mapping is visible per row.
- Study areas are derived from the subject groups of that institution's own Bachelor's and Master's records in the
  workbook, with counts in the audit file. They are a guide, not a programme list.
- Summary text is generated only from fields in the row (type, city, state, catalogue count and date).
- Private institutions are not in the workbook and therefore not in the import.

## Highlights and rankings (only where sourced)

- Excellence status: RWTH Aachen and Bonn confirmed in March 2026; Cologne, and Bochum with TU Dortmund (Ruhr
  Innovation Lab), selected on 2 Oct 2026. Source: Forschung & Lehre, linked per entry.
- Rankings: RWTH Aachen only — QS World University Rankings by Subject 2026: 25 Mechanical, Aeronautical &
  Manufacturing; 29 Materials Science; =39 Mineral & Mining; =53 Chemical Engineering; =53 Engineering & Technology
  (broad area). Source link: RWTH's own announcement. No other university has a ranking entry.
- 234 of 239 institutions have no highlight and none was invented.

## Photographs

13 photographs for 9 universities, all from Wikimedia Commons, stored with author, licence and source page.
12 are Creative Commons or public domain ("cleared"). 1 (TU Berlin, "copyrighted free use") is "pending review" and is
not shown to students. 230 institutions have no photograph and show a neutral placeholder.

## Trusted portals

- Hochschulkompass — `https://www.hochschulkompass.de/` — German Rectors' Conference (HRK).
- Study in Germany — `https://www.study-in-germany.de/en/` — DAAD.

Operators were confirmed on 17 Nov 2026 through web search of HRK, DAAD and German government pages. The two sites
could not be opened directly from the build environment, so **an admin should open both links once and press
"I checked this address today"** before switching them on.

## How to load (after approval; not done)

1. Apply UNI_V3 0002 (adds category, study areas, catalogue link, highlights, media table).
2. Import `universities-germany.csv` through Admin → Data Imports with the "skip" strategy, so a record that already exists is left as it is, never overwritten
   (the import lists matched rows for review).
3. Run `germany-enrichment-proposed.sql`.
4. Review and publish records in Admin → Universities.
