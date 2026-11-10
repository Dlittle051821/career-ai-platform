/**
 * NW-V5.4 — the chapter controller: one deliberate scroll gesture moves the
 * visitor to the next complete storytelling chapter.
 *
 * Why V5.3 could stop half-way: the approved engine (and the thought-card
 * controller) are pure functions of the scroll position. Each N transition
 * is spread over 0.95 viewport-heights of scroll, so wherever the visitor
 * stopped scrolling, the choreography stopped with it.
 *
 * V5.4 keeps that rendering contract untouched and separates two jobs:
 *   - navigation progress — which chapter the visitor is entering — is
 *     decided here, from intent (one wheel/trackpad gesture, one key press, a
 *     released touch swipe, a scene link), never from raw pixel distance;
 *   - animation progress — the approved N choreography — is then played to
 *     completion by carrying the scroll position, on a timed ease, to the
 *     chapter's resting point. The engine and the card controller render
 *     exactly what they always rendered for that position, forwards or back.
 *
 * It is the single authority over the story's scroll position: the engine's
 * scene links and focus handling, and the "Watch how it works" tour, all go
 * through goTo(). Outside the story (the site footer), and for zoom
 * gestures, horizontal scrolling, form fields and scrollable panels, the
 * browser's own scrolling is left alone.
 */
import { HOLD, LAST, TOTAL, clamp, sceneStart } from "@/lib/home/v4/engine";

export const V54_CHAPTERS = [
  { id: "hero", label: "Too many choices. One clearer direction." },
  { id: "pathways", label: "One platform, two pathways" },
  { id: "career", label: "Career Intelligence" },
  { id: "abroad", label: "Study Abroad" },
  { id: "studio", label: "Student Studio" },
  { id: "trust", label: "How we guide you" },
  { id: "conversion", label: "Your next step starts here" },
] as const;
export type V54ChapterId = (typeof V54_CHAPTERS)[number]["id"];

export const V54_SCROLL = {
  /** the hero is still until the questions begin to organise (V54_CLARITY_SPAN[0] = 0.04) */
  heroStill: 0.03,
  /** the trust statement has finished filling at this point of its hold (fill = EIO(hp × 1.15)) */
  trustRest: 0.9,
  /** timed playback of one transition: 0.95 scroll units (one N transition) ≈ 1150 ms */
  msPerUnit: 1150 / 0.95,
  minMs: 650,
  maxMs: 2000,
  /** wheel events closer together than this belong to the same gesture */
  gestureGapMs: 200,
  /** wheel distance (px) a gesture needs before it counts as intent */
  intentPx: 30,
  /** a released touch / scrollbar drag that moved past the chapter by this much (viewport heights) continues; less returns */
  commitUnits: 0.12,
  /** scroll must be idle this long before a free scroll (touch, scrollbar, find-in-page) is settled */
  settleMs: 160,
} as const;

export type V54Span = { lo: number; hi: number; rest: number };

/**
 * The scroll range (in viewport heights) over which a chapter looks exactly
 * the same as at rest, and its resting point. Between two spans lies the
 * approved transition.
 */
export function chapterSpan(k: number): V54Span {
  const s0 = sceneStart(k);
  const h = HOLD[k] ?? 0;
  if (k <= 0) return { lo: 0, hi: V54_SCROLL.heroStill, rest: 0 };
  if (k === 5) {
    const rest = s0 + h * V54_SCROLL.trustRest;
    return { lo: rest, hi: s0 + h, rest };
  }
  return { lo: s0, hi: s0 + h, rest: s0 + h * 0.5 };
}

export const V54_SPANS: readonly V54Span[] = Array.from({ length: LAST + 1 }, (_, k) => chapterSpan(k));

/** The chapter whose span contains s, or null while between chapters. */
export function chapterAt(s: number, eps = 0.002): number | null {
  for (let k = 0; k <= LAST; k++) {
    const sp = V54_SPANS[k]!;
    if (s >= sp.lo - eps && s <= sp.hi + eps) return k;
  }
  return null;
}

/** The next chapter in a direction from s (or the nearest one when dir = 0). */
export function chapterToward(s: number, dir: number): number {
  if (dir > 0) {
    for (let k = 0; k <= LAST; k++) if (V54_SPANS[k]!.lo >= s - 0.002) return k;
    return LAST;
  }
  if (dir < 0) {
    for (let k = LAST; k >= 0; k--) if (V54_SPANS[k]!.hi <= s + 0.002) return k;
    return 0;
  }
  let best = 0,
    bd = Infinity;
  for (let k = 0; k <= LAST; k++) {
    const sp = V54_SPANS[k]!;
    const d = s < sp.lo ? sp.lo - s : s > sp.hi ? s - sp.hi : 0;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

export type V54Plan = {
  to: number;
  /** jump here first (inside the current chapter's still span, so the jump is invisible) */
  start: number;
  /** play the approved transition from start to end on a timed ease */
  end: number;
  /** then settle on the chapter's resting point (inside its still span) */
  rest: number;
  durationMs: number;
};

/** How to get from scroll position s to chapter `to` so that only the real transition is animated. */
export function planChapter(s: number, to: number): V54Plan {
  const target = V54_SPANS[clamp(to, 0, LAST)]!;
  const from = chapterAt(s);
  const fromSpan = from === null ? null : V54_SPANS[from]!;
  let start = s,
    end = target.rest;
  if (from !== to) {
    if (target.lo > s) {
      start = fromSpan ? fromSpan.hi : s;
      end = target.lo;
    } else {
      start = fromSpan ? fromSpan.lo : s;
      end = target.hi;
    }
  }
  const dist = Math.abs(end - start);
  const durationMs = dist < 1e-3 ? 0 : clamp(dist * V54_SCROLL.msPerUnit, V54_SCROLL.minMs, V54_SCROLL.maxMs);
  return { to, start, end, rest: target.rest, durationMs };
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Turns a stream of wheel events into navigation intents. A mouse wheel spun
 * several notches, or a trackpad swipe with its long inertia tail, is ONE
 * gesture and yields one intent. A new gesture starts after a pause, on a
 * change of direction, or when a fresh swipe interrupts a decaying inertia
 * tail (the delta surges again after it had been falling).
 */
export class WheelIntent {
  private lastT = -Infinity;
  private dir = 0;
  private acc = 0;
  private fired = false;
  private peak = 0;
  private decaying = false;
  private recent: number[] = [];

  constructor(
    private readonly gapMs: number = V54_SCROLL.gestureGapMs,
    private readonly intentPx: number = V54_SCROLL.intentPx,
  ) {}

  /** Feed one wheel event (time in ms, vertical delta in px). Returns ±1 when it starts a new navigation intent, otherwise 0. */
  feed(t: number, dy: number): -1 | 0 | 1 {
    const d = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    if (d === 0) return 0;
    const a = Math.abs(dy);
    const lastMax = this.recent.length ? Math.max(...this.recent.slice(-3)) : 0;
    const surge = this.decaying && this.recent.length >= 3 && a > 1.6 * lastMax && a > 15;
    if (t - this.lastT > this.gapMs || d !== this.dir || surge) {
      this.dir = d;
      this.acc = 0;
      this.fired = false;
      this.peak = 0;
      this.decaying = false;
      this.recent = [];
    }
    this.lastT = t;
    this.recent.push(a);
    if (this.recent.length > 8) this.recent.shift();
    if (a > this.peak) this.peak = a;
    else if (a < 0.7 * this.peak) this.decaying = true;
    this.acc += a;
    if (!this.fired && this.acc >= this.intentPx) {
      this.fired = true;
      return d as -1 | 1;
    }
    return 0;
  }
}

/** Normalises a wheel delta to pixels (line and page modes). */
export function wheelPx(e: Pick<WheelEvent, "deltaY" | "deltaMode">, pageH: number): number {
  return e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * pageH : e.deltaY;
}

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-v54-free]";

/** True when the browser should handle this wheel itself: inside a field or a panel that can still scroll that way. */
export function wantsNativeScroll(target: EventTarget | null, root: HTMLElement, dy: number): boolean {
  let el = target instanceof Element ? target : null;
  if (el?.closest(EDITABLE)) return true;
  while (el && el !== root && el !== document.body) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 1) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        if (dy < 0 && el.scrollTop > 0) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

export type V54ChapterController = {
  goTo: (k: number, how?: "smooth" | "instant") => Promise<void>;
  step: (dir: -1 | 1) => void;
  current: () => number;
  busy: () => boolean;
  stop: () => void;
};

export type V54ChapterOptions = {
  /** performance.now() before which navigation waits (the approved intro holds the scroll until 4.2 s) */
  readyAt: number;
  /** QA capture freezes the page: no handlers */
  capture?: boolean;
  onChange?: (k: number) => void;
};

export function startChapters(root: HTMLElement, options: V54ChapterOptions): V54ChapterController {
  const scroller = root.querySelector<HTMLElement>("[data-nw4-scroller]");
  const sticky = root.querySelector<HTMLElement>("[data-nw4-sticky]");
  const live = root.querySelector<HTMLElement>("[data-v54-live]");
  const layers = Array.from(root.querySelectorAll<HTMLElement>(".nw4-layer"));
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const noop: V54ChapterController = { goTo: async () => {}, step: () => {}, current: () => 0, busy: () => false, stop: () => {} };
  if (!scroller || !sticky || options.capture) return noop;

  let top = 0,
    vh = 1,
    current = 0,
    raf = 0,
    moving = false,
    pending: -1 | 1 | 0 = 0,
    pendingTimer = 0,
    settleTimer = 0,
    touching = false,
    pointerDown = false,
    lastY = window.scrollY,
    lastDir = 0,
    ownY = NaN,
    keyboardNav = false,
    gestureFrom = NaN,
    resolveMove: (() => void) | null = null;
  const intent = new WheelIntent();

  const layout = () => {
    vh = sticky.clientHeight || window.innerHeight;
    top = scroller.getBoundingClientRect().top + window.scrollY;
  };
  const units = () => (window.scrollY - top) / vh;
  const yOf = (s: number) => top + s * vh;
  const inStory = (s: number) => s >= -0.01 && s <= TOTAL + 0.01;
  const jump = (s: number) => {
    ownY = Math.round(yOf(s));
    window.scrollTo({ top: yOf(s), behavior: "instant" });
  };

  function setCurrent(k: number) {
    current = k;
    const ch = V54_CHAPTERS[k]!;
    if (root.dataset.v54Chapter !== ch.id) {
      root.dataset.v54Chapter = ch.id;
      if (live) live.textContent = `${ch.label} — section ${k + 1} of ${V54_CHAPTERS.length}`;
      options.onChange?.(k);
    }
  }

  /** after keyboard navigation, focus must not be left inside a scene that has just been hidden */
  function fixFocus(k: number) {
    const a = document.activeElement as HTMLElement | null;
    const layer = a?.closest<HTMLElement>(".nw4-layer");
    const target = layers[k];
    if (!layer || !target || layer === target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  function finish(k: number, rest: number) {
    jump(rest);
    moving = false;
    delete root.dataset.v54Moving;
    setCurrent(k);
    if (keyboardNav) fixFocus(k);
    keyboardNav = false;
    resolveMove?.();
    resolveMove = null;
    if (pending) {
      const d = pending;
      pending = 0;
      step(d);
    }
  }

  function goTo(k: number, how: "smooth" | "instant" = "smooth"): Promise<void> {
    const to = clamp(Math.round(k), 0, LAST);
    cancelAnimationFrame(raf);
    resolveMove?.();
    const plan = planChapter(units(), to);
    if (how === "instant" || mql.matches || plan.durationMs === 0) {
      moving = false;
      finish(to, plan.rest);
      return Promise.resolve();
    }
    moving = true;
    root.dataset.v54Moving = V54_CHAPTERS[to]!.id;
    jump(plan.start);
    const t0 = performance.now();
    return new Promise<void>((resolve) => {
      resolveMove = resolve;
      const frame = (now: number) => {
        if (!moving) return;
        const p = Math.min(1, (now - t0) / plan.durationMs);
        jump(plan.start + (plan.end - plan.start) * easeInOutCubic(p));
        if (p < 1) raf = requestAnimationFrame(frame);
        else finish(to, plan.rest);
      };
      raf = requestAnimationFrame(frame);
    });
  }

  function step(dir: -1 | 1) {
    const to = clamp(current + dir, 0, LAST);
    if (to !== current) void goTo(to);
  }

  /**
   * Wheel and touch input that arrives while a transition is playing is consumed (one gesture = one chapter,
   * however long the trackpad's inertia tail). A key press during a transition is remembered (one step), as
   * keyboard users expect repeated presses to count. Input during the intro waits for the hero to settle.
   */
  function request(dir: -1 | 1, source: "wheel" | "key") {
    const wait = options.readyAt - performance.now();
    if (moving && source === "wheel") return;
    if (moving || wait > 0) {
      pending = dir;
      if (!moving && !pendingTimer)
        pendingTimer = window.setTimeout(() => {
          pendingTimer = 0;
          const d = pending;
          pending = 0;
          if (d && !moving) step(d);
        }, wait);
      return;
    }
    step(dir);
  }

  const enabled = () => !root.hasAttribute("data-v54-menu-open");

  const onWheel = (e: WheelEvent) => {
    if (e.defaultPrevented || e.ctrlKey || !enabled()) return;
    const dy = wheelPx(e, vh);
    if (Math.abs(e.deltaX) > Math.abs(dy) || dy === 0) return;
    if (wantsNativeScroll(e.target, root, dy)) return;
    // every vertical wheel event is fed to the gesture detector — including the ones the browser scrolls natively
    // (in the footer), so a gesture that carries the visitor back into the story is not mistaken for a new one
    const d = intent.feed(e.timeStamp || performance.now(), dy);
    const s = units();
    if (!inStory(s)) return;
    // the story's ends hand over to ordinary page scrolling (the site footer below)
    if (!moving && dy > 0 && current === LAST && s >= V54_SPANS[LAST]!.lo - 0.01) return;
    if (!moving && dy < 0 && current === 0 && s <= V54_SPANS[0]!.hi) return;
    e.preventDefault();
    if (d) request(d, "wheel");
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !enabled()) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest(EDITABLE)) return;
    let dir: -1 | 0 | 1 = 0;
    if (e.key === "PageDown" || e.key === "ArrowDown") dir = 1;
    else if (e.key === "PageUp" || e.key === "ArrowUp") dir = -1;
    else if (e.key === " " || e.key === "Spacebar") {
      if (t?.closest("button, a, [role='button'], [role='tab'], summary")) return;
      dir = e.shiftKey ? -1 : 1;
    }
    if (!dir || !inStory(units())) return;
    if (!moving && dir > 0 && current === LAST) return;
    if (!moving && dir < 0 && current === 0) return;
    e.preventDefault();
    keyboardNav = true;
    request(dir, "key");
  };

  // free scrolling (touch, scrollbar, find-in-page, restored position): once it comes to rest between
  // two chapters, finish the transition the visitor started — or return if they barely moved
  // never snap while the visitor is working in a form field inside the story: wait until they leave it
  const editing = () => {
    const a = document.activeElement;
    return a instanceof HTMLElement && root.contains(a) && Boolean(a.closest(EDITABLE));
  };
  let afterField = false;
  function settle() {
    settleTimer = 0;
    if (moving || touching || pointerDown) return;
    if (editing()) {
      afterField = true;
      return;
    }
    const s = units();
    if (!inStory(s)) return;
    const k = chapterAt(s);
    if (!Number.isNaN(gestureFrom)) {
      // a released touch swipe is judged by how far the swipe itself moved: enough → the next chapter in that
      // direction (completed); too little → back to the chapter it started from
      const moved = s - gestureFrom;
      gestureFrom = NaN;
      const dir = moved > 0 ? 1 : -1;
      let to = current;
      if (Math.abs(moved) >= V54_SCROLL.commitUnits) to = k === null ? chapterToward(s, dir) : k === current ? clamp(current + dir, 0, LAST) : k;
      else if (k !== null) return setCurrent(k);
      void goTo(to);
      return;
    }
    if (k !== null) return setCurrent(k);
    // any other free scroll (scrollbar drag, find-in-page) that stopped between chapters: finish what it started,
    // or return if it barely left the chapter
    const cur = V54_SPANS[current]!;
    const dir = lastDir || (s > cur.hi ? 1 : -1);
    const past = dir > 0 ? s - cur.hi : cur.lo - s;
    const to = past < V54_SCROLL.commitUnits ? current : chapterToward(s, dir);
    void goTo(to);
  }
  const schedule = () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, V54_SCROLL.settleMs);
  };
  const onScroll = () => {
    const y = window.scrollY;
    if (moving || Math.abs(y - ownY) <= 1) {
      lastY = y;
      return;
    }
    if (y !== lastY) lastDir = y > lastY ? 1 : -1;
    lastY = y;
    schedule();
  };
  const onTouchStart = () => {
    touching = true;
    gestureFrom = units();
    if (moving) {
      // the visitor takes over: stop the timed playback where it is
      moving = false;
      cancelAnimationFrame(raf);
      delete root.dataset.v54Moving;
      resolveMove?.();
      resolveMove = null;
      pending = 0;
    }
  };
  const onTouchEnd = () => {
    touching = false;
    schedule();
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") pointerDown = true;
  };
  const onPointerUp = () => {
    if (!pointerDown) return;
    pointerDown = false;
    schedule();
  };
  const onFocusOut = () => {
    if (!afterField) return;
    afterField = false;
    schedule();
  };
  let resizeRaf = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      layout();
      if (!moving && inStory(units())) jump(V54_SPANS[current]!.rest);
    });
  };

  layout();
  {
    // a refresh or Back can restore any position: start from a complete chapter
    const s = units();
    if (inStory(s)) {
      const k = chapterAt(s);
      if (k === null) {
        current = chapterToward(s, 0);
        jump(V54_SPANS[current]!.rest);
      } else current = k;
    }
    setCurrent(current);
  }

  const nonPassive = { passive: false } as const;
  window.addEventListener("wheel", onWheel, nonPassive);
  window.addEventListener("keydown", onKey);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("resize", onResize);
  root.addEventListener("focusout", onFocusOut);

  return {
    goTo,
    step,
    current: () => current,
    busy: () => moving,
    stop: () => {
      moving = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      window.clearTimeout(settleTimer);
      window.clearTimeout(pendingTimer);
      resolveMove?.();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      root.removeEventListener("focusout", onFocusOut);
      delete root.dataset.v54Chapter;
      delete root.dataset.v54Moving;
    },
  };
}
