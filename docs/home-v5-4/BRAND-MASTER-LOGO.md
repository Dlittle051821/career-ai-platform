# Nextwise Master Logo v1.0: assets, component and rollout audit

## Approved artwork

| Element | Source used | Notes |
|---|---|---|
| Upward-arrow **N symbol** | `public/brand/nextwise-icon.png`, the original approved icon (1336 × 1336). It is the same file the animated N uses. | Not redrawn, recoloured, rotated or reshaped. `nextwise-master-symbol.png` is a lossless crop of it to its opaque bounds (1073 × 853). |
| **"extwise" wordmark**, with the blue-accented **x** | Extracted from the approved *Nextwise Master Logo v1.0* raster (1448 × 1086, on a light-blue gradient). | The background was estimated and removed. Alpha and true ink colour were recovered by colour unmixing, so the x keeps its blue gradient and the strokes keep their anti-aliasing. |
| **Tagline** "Know What's Next." with rules | Same raster. | Kept exactly as drawn, including the letter-spacing and the rules. |

**Placement.** In the lockups, the N is the original icon scaled and positioned to the master's N:

- scale 0.3467 of the 1336 px icon;
- placed at (112.3, 237.3) in master pixels.

The master raster's own N is about 5% taller than the official icon, which suggests the mockup slightly stretched it. The official proportions were kept, as the brief locks the N geometry. The difference is documented, not hidden.

## Files (`public/brand/master-v1/`)

| File | Size | Use |
|---|---|---|
| `nextwise-master-full-light.png` | 1125 × 373 | N + wordmark + tagline, on light grounds |
| `nextwise-master-full-dark.png` | 1125 × 373 | Same alpha artwork, recoloured for Deep Navy (see below) |
| `nextwise-master-horizontal-light.png` | 1125 × 300 | N + wordmark, on light grounds |
| `nextwise-master-horizontal-dark.png` | 1125 × 300 | N + wordmark, on dark grounds |
| `nextwise-master-symbol.png` | 1073 × 853 | The N only (lossless crop of the original icon) |

**Dark recolouring.** The dark files ink the wordmark in Canvas white `#F9FAFC`, the x in Soft Aqua `#90E0EF` and the tagline in Ice Blue `#CAF0F8`. The N is never recoloured.

All files are transparent PNGs, served through `next/image`, which generates WebP/AVIF at the rendered size.

**Resolution.** The wordmark comes from a 1448 px raster, so it is sharp up to about 560 CSS px wide at 2× DPR. That is ample for headers and cards, but not for print or large-format use; that needs the vector master.

## Component: `NextwiseBrandLogo`

```tsx
<NextwiseBrandLogo variant="horizontal" tone="light" height={30} />
```

| `variant` | Artwork | Minimum height |
|---|---|---|
| `full` | N + "extwise" + tagline | 48 px |
| `horizontal` | N + "extwise" | 26 px |
| `compact` | Horizontal artwork without clear-space padding, for tight UI such as mobile headers | 22 px |
| `symbol` | The original N | 20 px |

- **Tone.** `tone="light" | "dark"` selects the ink set; the N is identical in both.
- **Proportions.** The width always follows the artwork's own proportions.
- **Clear space.** The default clear space is 12% of the height (none for `compact` and `symbol`).
- **Single mapping.** Every variant resolves through `brandArtwork()` in `src/lib/brand/master-logo.ts`, the single mapping from variant and tone to file.

## Vector master: what is needed before the site-wide rollout

The approved logo is only available as a raster mockup, so the files above are faithful raster derivatives, not a vector master. To produce the master:

1. **N symbol.** Use the original source file for the N icon (the vector or high-resolution file that `nextwise-icon.png` was exported from), with its exact gradient stops. Do not re-trace it from the PNG.
2. **Wordmark.** Have a designer redraw "extwise" as outlined paths from the approved raster, matching:
   - stroke contrast;
   - the bracketed serifs on the t;
   - the x's crossing and its blue gradient (start and end colours sampled from the raster);
   - the dot of the i.

   Supply a font licence if the wordmark was built from a typeface.
3. **Tagline.** Set the tagline in the typeface it was drawn with (identify and licence it), with the measured tracking and the two rules.
4. **Deliverables:**
   - SVG and PDF of every variant: full, horizontal, symbol;
   - light, dark and single-colour (navy or white) versions;
   - clear-space and minimum-size rules;
   - a favicon/app-icon set regenerated from the vector N.
5. **Swap.** Replace the five PNGs in `public/brand/master-v1/` with SVG exports of the same names and proportions. `NextwiseBrandLogo` needs only the file extension and dimensions changed in `master-logo.ts`.

## Current logo usage across the website (audit; nothing changed)

The current production lockup is `public/brand/nextwise-logo-horizontal.png`: N + "NEXTWISE" in capitals + tagline. Its dark version is flattened on navy. **None of these were modified.**

| Where | Component / file | Current asset | Replace with (after approval) |
|---|---|---|---|
| Site header, desktop | `src/components/navigation/Header.tsx` → `Logo` | `BRAND_LOGO.horizontal` | `NextwiseBrandLogo variant="horizontal" tone="light"` |
| Mobile navigation | `src/components/navigation/MobileNav.tsx` → `Logo` | `BRAND_LOGO.horizontal` | `variant="compact" tone="light"` |
| Footer | `src/components/navigation/Footer.tsx` → `Logo onDark` | `BRAND_LOGO.horizontalDark` (flattened navy plate) | `variant="full" tone="dark"` (transparent; no plate) |
| Student dashboard shell | `src/components/dashboard/DashboardShell.tsx` (2×) | `horizontalDark` | `variant="horizontal" tone="dark"` |
| Counsellor shell | `src/components/counsellor/CounsellorShell.tsx` (2×) | `horizontalDark` | `variant="horizontal" tone="dark"` |
| Admin shell | `src/components/admin/AdminShell.tsx` (2×) | `horizontalDark` | `variant="horizontal" tone="dark"` |
| Login / register / auth pages | `src/components/sections/auth/AuthLayout.tsx` | `horizontal` | `variant="full" tone="light"` |
| Motion Lab chrome (dev) | `src/components/motion-lab/LabChrome.tsx` | `horizontal` | `variant="horizontal"` |
| Shared `Logo` component | `src/components/navigation/Logo.tsx` | both lockups | Becomes a thin wrapper over `NextwiseBrandLogo`, the lowest-risk rollout path |
| Animated N (V4 homepage, motion lab, ribbon story) | `V4ConnectedHome.tsx`, `LivingPath.tsx`, `ribbon-story/n-arrow.ts` | `BRAND_LOGO.icon` (original N) | **No change**: already the approved N |
| App icons / PWA manifest | `src/app/manifest.ts`, `icon192/512`, apple-touch | Original N | Regenerate from the vector N when available |
| Payment checkout (Razorpay) | `src/components/payments/PayButton.tsx` | `icon512` | No change (N only) |
| Social share / Open Graph | `src/config/seo.ts`, `(site)/layout.tsx` | `nextwise-social-share.png` | Re-export the social card with the new wordmark |
| Structured data | `src/lib/seo/structured-data.ts` | `icon512` | No change |

Also check outside `src/` before rollout: transactional e-mail templates, PDF agreements and invoices, and the favicon `src/app/icon.png` / `apple-icon.png`.
