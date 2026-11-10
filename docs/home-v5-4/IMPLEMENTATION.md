# NextWise V5.4: full-screen responsive UX and chapter scrolling

V5.4 is the approved V5.3 homepage with four targeted UX changes:
- the chapter scroll controller;
- no page frame, with a full-bleed layout;
- Electric Coral navigation pills;
- separate Log in and Sign up actions.

Nothing visual was redesigned. The N geometry, the intro, every scene transition, the portrait, the question-card motion, the typography, the Future Horizon background and all scene content are unchanged.

Preview route: `/homepage-preview/v5-4` (development only, `noindex`); `?type=b` shows typography B. The homepage (`/`) is not changed.

## 1. Scroll: one gesture, one complete chapter

### Why V5.3 could stop half-way

The approved engine (`src/lib/home/v4/engine.ts`) and the thought-card controller are pure functions of `window.scrollY`. Each N transition is spread over 0.95 viewport-heights of scroll. Wherever the visitor stopped scrolling, the choreography stopped with it, which could be mid-wipe, with the N half-way along its arc.

### What V5.4 does (`src/lib/home/v54/chapters.ts`)

V5.4 keeps that rendering contract and separates two concerns:

- **Navigation progress** is the chapter the visitor is entering. It is decided from intent, not pixel distance:
  - one wheel or trackpad gesture;
  - one key press (Page Down, Space, ↓, Page Up, Shift+Space, ↑);
  - a released touch swipe;
  - a scene link.
- **Animation progress** is the approved choreography. It is played to completion by carrying the scroll position, on a timed ease-in-out, to the chapter's resting point. The engine renders exactly what it always rendered for each position, forwards or backwards.

### Chapters

The seven chapters match the seven approved scenes:

| # | Chapter |
|---|---|
| 1 | hero |
| 2 | pathways (the clarity transition plays on the way in) |
| 3 | career |
| 4 | abroad |
| 5 | studio |
| 6 | trust |
| 7 | conversion |

The state is exposed as `data-v54-chapter`, with `data-v54-moving` set while a transition plays.

### Chapter spans

Each chapter has a still span: the scroll range in which that scene is fully at rest. A step works in three moves:

1. Jump, invisibly, to the edge of the current span.
2. Play only the real transition, about 1.15 s per N transition. The hero → Two Pathways step includes the clarity moment and takes about 1.8 s.
3. Settle at the next chapter's resting point.

The trust chapter rests where its statement has finished filling.

### Gestures

`WheelIntent` groups wheel events into gestures. All of these count as one gesture:
- a mouse wheel spun several notches;
- a trackpad swipe with a long inertia tail.

A new gesture begins after a 200 ms pause, a change of direction, or a fresh swipe that interrupts a decaying inertia tail. A gesture needs at least 30 px of travel to count as intent.

Wheel input that arrives while a transition is playing is consumed rather than queued, so rapid input never skips chapters unpredictably. A key press during a transition counts as one queued step.

### Touch

Touch scrolling is never prevented: the page scrolls natively under the finger. When the swipe is released, the controller completes the transition into the next chapter if the swipe moved at least 0.12 viewport-heights. A smaller swipe returns to the chapter it started from.

### Free scrolling

This covers scrollbar drags, find-in-page and a restored position after refresh or Back. Once the scroll is idle (160 ms), the controller completes the nearest transition in the direction of travel, or returns if the scroll barely left the chapter. The story's full height is set in CSS before any JavaScript runs, so the browser restores the exact position.

### Left to the browser

The controller does not handle:
- zoom (Ctrl/⌘ + wheel);
- horizontal scrolling;
- form fields and scrollable panels;
- the site footer below the story.

The last chapter hands over to normal page scrolling, and scrolling back up from the footer lands on the complete last chapter. While a form field is focused, nothing snaps; the story settles only after focus leaves the field.

### Keyboard and focus

- The "Go to:" section links play the chapter transition. They stay in the viewport, so tabbing to them never moves the story.
- After keyboard navigation, focus moves into the new chapter if it was left in a hidden one.
- Each chapter change is announced in a polite live region.
- With reduced motion, chapters change instantly with no animated playback.

### Single authority

The controller is the only code that moves the story's scroll position:
- the engine's scene links and focus handling call it (`options.navigate`);
- the "Watch how it works" tour plays chapters through it.

### Engine fork

`src/lib/home/v54/engine.ts` is the V4 engine with exactly these edits; a test re-applies them to the V4 file and requires the result to match byte for byte:
- the stage rule;
- `options.navigate`;
- the images import path;
- the header comment.

`src/lib/home/v4/engine.ts` itself is untouched.

### Why not CSS scroll-snap

The browser's snap animation is short and fixed, which would compress a 1.15 s N transition into about 0.3 s. Its mandatory mode would also apply to the informational footer. A single small controller keeps the timing approved and leaves everything outside the story untouched.

## 2. No page frame; full-bleed at every size

- **Frame removed.** The rounded frame, its glow and the outer margins are gone.
- **Torso continuation.** The hero's portrait now runs to the bottom edge. It is continued by a one-pixel row averaged from the approved portrait's own rows 1140–1150, stretched and feathered (`v54-portrait-base.png`, 1860 × 1); no new imagery is used.
- **Backdrop** (`src/lib/home/v54/backdrop.ts`). Each scene's own background is painted across the whole viewport, behind the content stage. It mirrors the engine's inline layer styles in screen space, using a MutationObserver:
  - the same N-tip wipe circle, identical in size while it is inside the stage, then grown to the viewport corners;
  - the same rising sheet;
  - the same recede dimming.

  The stage is clipped to its box, one pixel inside, so no edge or seam is visible.
- **Horizon.** The Future Horizon now covers the whole viewport as the hero's backdrop panel.
- **Stage rule** (`src/lib/home/v54/stage.ts`). Each viewport gets whichever stage, desktop (1440 × 900) or portrait (390 × 844), fills more of it. Phones and portrait tablets (aspect below about 0.86) get the portrait composition; for example, 768 × 1024 now shows the portrait layout instead of a 768 × 480 strip.

  The stage is centred. Spare width or height becomes edge-to-edge atmosphere, so the content cluster never spreads across an ultrawide screen.
- **Header.** The header aligns with the content columns and sits at the top of the viewport.
- **Mobile closing headline.** The closing headline now fits on two lines on the portrait stage; in V5.3 it overlapped the line below it.

Verified at 360 × 800, 390 × 844, 768 × 1024, 1024 × 768, 1366 × 768, 1440 × 900, 1920 × 1080, 2560 × 1440, 3440 × 1440 and 3840 × 2160:
- no frame and no horizontal overflow;
- the backdrop covers the whole viewport;
- the actions are fully visible;
- the portrait is undistorted;
- text is at least 12 px.

## 3. Navigation pills

**Hover and focus.** Explore, How it works, Study Abroad and Pricing get an Electric Coral (`#FF4D6D`) pill with navy text (5.5:1 contrast). It is drawn by a pseudo-element using opacity and scale over about 200–220 ms, with a soft lift shadow.

**No layout shift.** Padding and size never change, and this was measured in the browser.

| State | Treatment |
|---|---|
| Keyboard focus | The same pill plus a 2 px navy outline |
| Press | The pill presses in to 0.95 |
| Touch devices (`hover: none`) | No sticky hover |
| Current page | `aria-current="page"`: weight plus a dot marker, not colour alone |

The question cards stay blue-and-white.

## 4. Log in / Sign up

| Action | Destination | Style |
|---|---|---|
| Log in | `/login` | Quiet outline |
| Sign up | `/register` | Electric Coral pill |
| Get started free | `/register` | The hero's primary action, unchanged, with its arrow microinteraction |

- **Existing flows.** `/login` keeps LoginForm's own safe `next` handling and role-aware default redirect.
- **Signed-in visitors.** The existing `useAuthProfile` hook, read-only and the same one the site's AccountMenu uses, swaps the actions for one link to the account's own workspace (from `getAccountMenuLinks`). The hero action becomes "Continue to your dashboard". No auth logic was added.
- **Phones and portrait tablets.** The header shows the logo, Sign up and a menu button. The menu holds the four links plus Log in and Sign up, with 48 px targets. Escape closes it and returns focus. The chapter controller pauses while the menu is open.

## Files

- **Route:** `src/app/(site)/homepage-preview/v5-4/page.tsx`
- **Components** (`src/components/sections/home/v54/`):
  - `NextwiseV54Home.tsx`, `NextwiseV54Hero.tsx`
  - `V54Account.tsx`, `V54Motion.tsx`
  - `ThoughtCard.tsx`, `V54Icons.tsx`, `fonts.ts`, `v54.css`
- **Library** (`src/lib/home/v54/`):
  - `chapters.ts`, `backdrop.ts`, `stage.ts`, `engine.ts` (fork)
  - `motion.ts`, `tour.ts`, `config.ts`
- **Tests** (65): `v54.test.ts` (V5.3 tests carried over) and `v54-ux.test.ts` (new)
- **Assets:** `public/home-v54/` (portrait, horizon and portrait base)
