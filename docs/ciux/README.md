# CIUX-01: Global UX Foundation

Branch `ciux/01-foundation`, created from `cc26/launch-readiness` at `8659828` (CC-26 follow-up 2). Not merged, not deployed.

## What CIUX-01 delivers

- One token system built from the homepage palette: navy `#03045F`, ocean, cyan, aqua, ice, and Electric Coral `#FF4D6D` as the only action colour (navy text on it). Purple retired.
- Sora headings, a fluid type scale, radius, shadow and motion tokens; reduced motion respected.
- One button system (primary, secondary, outline, outline-inverse, ghost, text, inverse, destructive; IconButton).
- A new header with Explore / Free tools / How it works menus plus Pricing, a mobile sheet with grouped sections, a Book a free session action everywhere, and the same menus inside the approved homepage header.
- A homepage "Start where you are" section after the unchanged story.
- A navy footer and a rebuilt contact page using the official contact details from one config file; the fake-success demo form is gone.
- 0 axe violations on 23 public routes (baseline 132), no overflow at 360 to 1440 px, homepage story pixel-identical to the baseline.

## CIUX-01B (header and page-hero unification)

[CIUX-01B-REPORT.md](CIUX-01B-REPORT.md) (root cause, architecture, route coverage, summary) and [CIUX-01B-TESTING.md](CIUX-01B-TESTING.md) (visual, interaction, homepage, accessibility and performance evidence). Branch `ciux/01b-header-hero` from `b15c162`; local review only.

## Documents

| | Document |
|---|---|
| A, C | [CIUX-01-DESIGN-SYSTEM.md](CIUX-01-DESIGN-SYSTEM.md): tokens, type, motion, components |
| B, F | [CIUX-01-UX-AUDIT.md](CIUX-01-UX-AUDIT.md): route audit and coverage matrix |
| D | [CIUX-01-NAVIGATION.md](CIUX-01-NAVIGATION.md): navigation architecture and behaviour |
| E | [CIUX-01-CONTACT-AUDIT.md](CIUX-01-CONTACT-AUDIT.md): contact cleanup and open items |
| H | [CIUX-01-TESTING.md](CIUX-01-TESTING.md): tests, homepage comparison, accessibility, performance |
| I | [CIUX-02-08-BACKLOG.md](CIUX-02-08-BACKLOG.md): next phases |
| G | Screenshots are delivered with the package (`C:\ClaudeBuilds\CIUX-01-PKG\screenshots`), not committed |

## Git delivery (J)

- Base: `8659828` on `cc26/launch-readiness`. Branch: `ciux/01-foundation` in its own worktree `C:\ClaudeBuilds\CIUX-01-FOUNDATION`, so the CC-26 worktree and `C:\carrier.ai` are untouched.
- Files: listed in `CIUX-01-MANIFEST.json` in the package (added, modified, deleted, with SHA-256).
- Checks the Finish script runs before committing: manifest hashes, no stray changes, CC-18 protected files unchanged, the 35 untouched V5.4 pins unchanged and the 4 re-pinned files as delivered, secret scan, TypeScript, ESLint, Vitest, npm audit, production build, `git diff --check`.
- Commit and (optional) plain push of the feature branch only. No merge, no deploy, no database, no environment change.

## Preview

After the Finish script commits, run `npm run build` then `npm start` in `C:\ClaudeBuilds\CIUX-01-FOUNDATION` (with your usual local `.env.local`), and open `http://localhost:3000`. Or push the branch and open the Vercel preview for `ciux/01-foundation` if previews are enabled for branches; nothing here deploys production.

## Blockers and open items

1. **Free Resume Builder** does not exist; it is not linked anywhere (CIUX-06).
2. **Mailbox delivery** for `founder@nextwise.com` and `co-founder@nextwise.com` is unverified. Please send a test e-mail to each.
3. **CC-26 QA acceptance** is still pending; CIUX-01 enables nothing gated.
4. Legal page text is still placeholder (needs counsel).

## Recommended next: CIUX-02 How It Works

Start with `src/app/(site)/how-it-works/page.tsx` and `src/components/sections/how-it-works/*`: one discover-to-apply sequence, an H1 that matches the homepage promise (India and abroad, not Europe only), and the free Discovery Session as the single primary action. Details in the backlog.
