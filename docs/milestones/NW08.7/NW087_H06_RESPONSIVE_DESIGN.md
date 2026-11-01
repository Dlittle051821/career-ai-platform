# NW08.7 · H06 · Responsive design notes

There are two compositions, not one scaled drawing (brief §10).

## Wide: laptop and desktop (≥1024px)

- **Copy:** absolutely positioned on the left (`left: max(6vw, 2.5rem)`, width `min(40rem, 44vw)`), vertically centred at 46%.
- **Art board:** viewBox 1200×760, anchored bottom-right (`right: 2vw`), height `min(88svh, 100% − 0.5rem)` with a fixed aspect ratio.
  - The ribbon's lead line runs under the copy column. Its crest, trough and rise sit to the right of the CTAs, and the loop holds the photo on the right.
  - At 1024px the board slightly overhangs the left edge (the lead line enters from off-screen); the loop always stays inside the board.
- **Photo window:** about 510×650 board units, roughly 36% of the width at 1440px. This matches the approved reference's proportion.
- **Pathways:** labels stacked below the actions, with nodes on the lead line.
- **Effects:** blurred ground shadow, and the front ribbon's blurred shadow on the photo.

## Compact: phones and tablet portrait (<1024px)

- **Copy:** stacked at the top. Headline `clamp(2.45rem, 9.6vw, 3.7rem)`; the actions wrap onto two lines only when there's no room.
- **Art board:** viewBox 800×760. A shorter lead line, a steeper rise and a taller loop, so the photograph stays large on a narrow screen. It is anchored bottom-right (`right: 3vw`), width `min(118vw, (100svh − 30rem) × 1.0526, 46rem)`.
  - On phones it is allowed to bleed off the left edge (the line enters from the edge) so the loop can be bigger.
  - It is height-limited on short phones (375×667), so it never collides with the actions.
- **Pathways:** a strip under the art (`CompactPathways`), 44px tap targets, never over the narrow artwork.
- **Reduced cost:** no blur filters at all, a smaller mask stroke, 220 slices instead of 260, and smaller images (portrait 640w, campus 828w).
- **Pin:** 250svh instead of 320svh.

## Breakpoint switch

Both compositions are in the HTML; CSS shows one (`lg:block` / `lg:hidden`). There is no JavaScript layout decision, so there is no hydration flash and no layout shift. Only the visible layout requests photographs, decided after hydration through `matchMedia`.

## Verified widths

375×667, 390×844, 768×1024, 1024×768, 1280×800 and 1440×900, at nine progress points each, forwards and backwards. No horizontal overflow at any point. See H10 and `evidence/homepage/`.

## Guarantees enforced by tests

- The whole ribbon stays inside its art board in both layouts, so the frame never cuts it.
- The portrait's face sits inside the loop, clear of the ribbon band, at every point of its drift, in both layouts.
- Photographs always cover the loop (no empty corners), including both ends of the campus pan.
- The two compositions are genuinely different.
