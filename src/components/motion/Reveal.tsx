"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * CIUX-01 — the shared scroll reveal. Content is rendered visible on the
 * server; only after hydration, and only when the visitor allows motion and
 * the element is below the fold, is it set to "pending" and then revealed
 * once (a 14 px lift and fade, 360 ms). No layout shift, no library.
 */
export function Reveal({ as: Tag = "div", children, className }: { as?: ElementType; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.ciuxReveal = "pending";
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.ciuxReveal = "shown";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={["ciux-reveal", className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}
