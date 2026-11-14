/**
 * NW-V5.6.2 — the approved Electric Coral destination transition.
 *
 * The coral circle grows from the activated button to cover the screen, the
 * real destination route is opened underneath it (client-side navigation, so
 * the page is already prefetched), and the coral lifts as soon as the
 * destination has rendered — the visitor lands on the real Study Options /
 * Career Discovery page, never on a decorative pink screen.
 *
 * The overlay lives on <body>, outside React, so it survives the homepage
 * unmounting. It is self-cleaning: removed after the reveal, on bfcache
 * restore, and after a hard time-out (with a full-page load as the fallback
 * if client navigation never happened).
 *
 * Second and later uses in a session play a shorter version (no label), and
 * reduced motion skips the overlay entirely.
 */

const SEEN_KEY = "nw562-route-seen";
const OVERLAY_CLASS = "tp562-route";
/** GSAP curves as CSS cubic-béziers (power3.inOut ≈ quartic, power2.out ≈ cubic). */
const EASE_WIPE = "cubic-bezier(0.76, 0, 0.24, 1)";
const EASE_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";
const EASE_IN = "cubic-bezier(0.32, 0, 0.67, 0)";

export type RouteTransitionTiming = { delay: number; wipe: number; label: boolean; hold: number; lift: number };

/** Full first time in a session; short afterwards (ms). */
export function routeTiming(short: boolean): RouteTransitionTiming {
  return short ? { delay: 60, wipe: 560, label: false, hold: 0, lift: 320 } : { delay: 100, wipe: 850, label: true, hold: 300, lift: 450 };
}

function seenThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage unavailable: always the full version */
  }
}

let restoreHooked = false;
function removeAll() {
  document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((n) => n.remove());
}

export type RouteTransitionOptions = {
  href: string;
  /** centre of the activated control, viewport px */
  x: number;
  y: number;
  /** e.g. "Study Options" */
  label: string;
  reduced: boolean;
  navigate: (href: string) => void;
  /** resolved font stacks (the homepage's next/font families) */
  fontDisplay?: string;
  fontBody?: string;
};

export function playRouteTransition(o: RouteTransitionOptions): void {
  if (!restoreHooked) {
    restoreHooked = true;
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) removeAll();
    });
  }
  const target = new URL(o.href, window.location.href);
  const arrived = () => window.location.pathname === target.pathname;

  if (o.reduced) {
    o.navigate(o.href);
    return;
  }

  removeAll();
  const T = routeTiming(seenThisSession());
  markSeen();

  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.tpRoute = target.pathname;
  const inner = document.createElement("div");
  inner.className = "tp562-route-inner";
  if (o.fontDisplay) inner.style.fontFamily = o.fontDisplay;
  const k = document.createElement("p");
  k.className = "tp562-route-k";
  k.textContent = "Opening";
  if (o.fontBody) k.style.fontFamily = o.fontBody;
  const t = document.createElement("p");
  t.className = "tp562-route-t";
  t.textContent = o.label;
  inner.append(k, t);
  overlay.append(inner);
  document.body.append(overlay);

  const vw = window.innerWidth,
    vh = window.innerHeight;
  const R = Math.hypot(Math.max(o.x, vw - o.x), Math.max(o.y, vh - o.y)) + 2;
  const at = `${o.x.toFixed(1)}px ${o.y.toFixed(1)}px`;
  overlay.style.clipPath = `circle(0px at ${at})`;
  const wipe = overlay.animate([{ clipPath: `circle(0px at ${at})` }, { clipPath: `circle(${R.toFixed(1)}px at ${at})` }], {
    duration: T.wipe,
    delay: T.delay,
    easing: EASE_WIPE,
    fill: "forwards",
  });
  if (T.label) {
    inner.animate(
      [
        { opacity: 0, transform: "translateY(24px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 500, delay: 700, easing: EASE_OUT, fill: "forwards" },
    );
  }

  const t0 = performance.now();
  let navigated = false;
  let lifted = false;

  const lift = () => {
    if (lifted) return;
    lifted = true;
    const a = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.lift, easing: EASE_IN, fill: "forwards" });
    a.onfinish = () => overlay.remove();
    window.setTimeout(() => overlay.remove(), T.lift + 40);
  };

  // open the real route once the screen is covered (the finish event, or the clock if animation events are throttled)
  const covered = () => {
    if (navigated) return;
    navigated = true;
    overlay.style.clipPath = "none";
    o.navigate(o.href);
    waitForArrival();
  };
  wipe.onfinish = covered;
  window.setTimeout(covered, T.delay + T.wipe + 20);

  function waitForArrival() {
    const start = performance.now();
    const tick = () => {
      if (lifted) return;
      if (arrived()) {
        // two frames: the destination has rendered and painted under the coral
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const minEnd = t0 + T.delay + T.wipe + T.hold;
            window.setTimeout(lift, Math.max(0, minEnd - performance.now()));
          }),
        );
        return;
      }
      if (performance.now() - start > 8000) {
        // client navigation never completed: load the page the classic way
        window.location.assign(target.href);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // last-resort safety: never leave the coral up
  window.setTimeout(() => {
    covered();
    if (!lifted && arrived()) lift();
  }, T.delay + T.wipe + 9000);
}
