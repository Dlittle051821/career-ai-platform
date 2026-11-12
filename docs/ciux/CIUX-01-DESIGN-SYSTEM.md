# CIUX-01: Design system (deliverables A and C)

The shared foundation every page now inherits. It is built from the colours, type and motion of the approved V5.4 homepage, so internal pages match the homepage instead of the older UX10 blue and purple system.

Source of truth: `src/app/globals.css` (tokens), `src/components/ui/Button.tsx` (buttons), `src/config/contact.ts` and `src/config/site.ts` (contact and navigation data).

## 1. Colour

### Brand palette (from the homepage)

| Token | Value | Use |
|---|---|---|
| `--brand-navy` / `--brand-primary` | `#03045F` | Headings, primary text on light, dark surfaces (footer, CTA bands) |
| `--brand-ocean` | `#0077B6` | Fills and decoration only (4.36:1 on surface-alt, so not for small text there) |
| `--color-secondary` | `#00679E` | Ocean deepened one step for text and links: 6.12:1 on white, 5.48:1 on surface-alt |
| `--brand-cyan` | `#00B4D8` | Intelligence accents, icons, chips (never small text) |
| `--brand-aqua` | `#90E0EF` | Eyebrows and accents on navy |
| `--brand-ice` / `--brand-ice-pale` | `#CAF0F8` / `#E0F4FB` | Pale info surfaces, icon chips |
| `--brand-action` | `#FF4D6D` | Electric Coral: the one action colour (primary buttons) |
| `--brand-action-hover` / `-active` | `#FF5F7B` / `#F23A5E` | Hover and press |
| `--brand-on-action` | `#03045F` | Text on coral: navy, 5.51:1. White on this coral is only 3.2:1, so it is not used |
| `--brand-coral-strong` | `#C81E45` | Coral as text or icon on white: 5.63:1 |
| `--brand-coral-deep` | `#B3123A` | Signal text on pale coral |
| `--brand-coral-pale` | `#FFE4E9` | Hover and selected backgrounds in menus |

The legacy purple (`#4c2e8c`) is retired: `--brand-violet` now resolves to ocean-strong `#005A8C`, and the lavender pastel resolves to ice/navy. A test asserts no purple hex remains as a live token value. Legacy names (`--brand-coral`, `--brand-violet`, `--color-accent`) are kept as aliases so no existing page loses a colour.

### Neutrals and states

| Token | Value | Contrast on white |
|---|---|---|
| `--color-text` / `--brand-ink` | `#0B1033` | 18.9:1 |
| `--color-text-soft` | `#3E4F72` | 8.18:1 |
| `--color-muted` | `#4A5068` | 7.96:1 |
| `--color-border` / `-strong` | `#D5DDE8` / `#8E9BB3` | Hairline / input border (3:1 for controls) |
| `--color-surface-alt` | `#EEF3F8` | Alternate section and hover surface |
| danger | `#B42318` on `#FDECEA` | 6.6:1 |
| info | `#005A8C` on `#E0F4FB` | 6.5:1 |

On navy (`--color-ink`): `--color-on-ink` `#FFFFFF`, `--color-on-ink-muted` `#B9C3E6` (8.9:1).

## 2. Typography

| Role | Family | Notes |
|---|---|---|
| Headings (`h1`–`h4`, `.font-display`) | Sora 500/600/700 | Letter-spacing −0.02em, matches the homepage headline voice |
| Body and UI | Plus Jakarta Sans | Unchanged |
| Homepage display | Space Grotesk and Fraunces | Untouched: the homepage keeps its own scoped type (`.nw4` resets) |

Type scale tokens (fluid, `clamp()`): `--text-display`, `--text-h1`, `--text-h2`, `--text-h3`, `--text-lead`, each with a `--line-height` companion. `PageHero` and `SectionHeading` use them, so every internal page heading now scales the same way.

Eyebrows are sentence case in `SectionHeading` and `PageHero` (no tracked-out capitals). 137 page files still set their own `uppercase tracking-wide` labels; those are listed for page-level cleanup in CIUX-02 onward rather than rewritten blindly here.

## 3. Shape, elevation, motion

- Radii: `--radius-control` 0.75rem (inputs), `--radius-card` 1.25rem (cards, menus), `--radius-pill` 999px (buttons, nav triggers).
- Shadows are navy-tinted (`--shadow-soft`, `--shadow-lifted`), plus `--shadow-action` (a soft coral glow on primary-button hover).
- Motion tokens: `--ease-out-soft` `cubic-bezier(.2,.8,.2,1)` (the homepage's easing), `--duration-fast` 150ms, `--duration-base` 220ms, `--duration-slow` 360ms.
- Motion rules: motion answers an action (menu open, hover lift of 1px, press scale 0.98). The only non-triggered motion is the optional `Reveal` (14px lift and fade, once, below the fold only). Under `prefers-reduced-motion: reduce`, menu fades, sheet slides, reveals and button lifts are switched off.

## 4. Components (deliverable C)

| Component | File | Status |
|---|---|---|
| Button, LinkButton, IconButton | `components/ui/Button.tsx` | Rewritten. Variants: `primary` (coral, navy text), `secondary` (navy), `outline`, `outline-inverse` (for navy surfaces), `ghost`, `text`, `inverse` (white on navy), `destructive`. Sizes sm 40 / md 44 / lg 52 px. `IconButton` requires a `label` |
| Header | `components/navigation/Header.tsx` | Rewritten: sticky, transparent at top, frosted on scroll, 72 to 64 px |
| Desktop menus | `components/navigation/NavMenus.tsx` | New. Disclosure pattern (see CIUX-01-NAVIGATION.md); shared by the site header and the homepage header |
| Mobile menu | `components/navigation/MobileNav.tsx`, `MobileNavGroups.tsx` | Rewritten: native `<dialog>` sheet with grouped disclosures; groups shared with the homepage mobile menu |
| Footer | `components/navigation/Footer.tsx` | Rewritten on navy, with official contacts |
| Logo | `components/navigation/Logo.tsx` | Now wraps the master `NextwiseBrandLogo`; the logo artwork is unchanged |
| FeatureCard | `components/ui/FeatureCard.tsx` | New: whole-card link, light or ink tone |
| QuickExplore | `components/sections/home/QuickExplore.tsx` | New homepage section after the story |
| Reveal | `components/motion/Reveal.tsx` | New, optional scroll reveal (not yet applied to pages) |
| Card, SectionHeading, PageHero | `components/ui`, `components/sections` | Restyled through tokens; APIs unchanged |
| CTASection | `components/sections/CTASection.tsx` | Coral primary and `outline-inverse` secondary on the navy band |
| Contact composer | `components/sections/contact/ContactEmailComposer.tsx` | New, honest mailto composer (replaces the demo form) |
| Forms | `components/forms/*` | Existing `FormField`, `Input`, `Select`, `Textarea`, `Checkbox`; they inherit the new tokens. A visual pass is in the backlog |
| Accordion | `FaqAccordion` (native `<details>`) | Existing; inherits tokens |
| Tabs | none shared | Pages use local tab markup; a shared Tabs is backlog (CIUX-03) |
| States | `EmptyState`, `UnavailableNotice`, `ComingSoon`, `FormSuccessNotice`, `GuidanceNotice` | Existing; inherit tokens |
| Modal | native `<dialog>` (as in `MobileNav`) | Pattern documented; no new generic modal was needed |

### Button usage rules

- One coral primary per view region. Everything else is `secondary`, `outline` or `ghost`.
- On navy surfaces use `primary` plus `outline-inverse` or `inverse`.
- `destructive` only for irreversible actions, always with a confirmation step.
- Never put white text on coral.
