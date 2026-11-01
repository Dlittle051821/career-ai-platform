import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HERO_ACTIONS, HERO_COPY } from "@/lib/home/signature-hero/content";
import { cn } from "@/lib/utils";
import { frauncesItalic } from "./fonts";

/**
 * NW08.7 — the hero's words and actions. Plain server-renderable markup:
 * present in the initial HTML, readable and usable before any animation
 * script loads. The only motion is the CSS opening reveal in
 * signature-hero.css, which reduced-motion turns off.
 */
export function SignatureHeroCopy({ headingId, className }: { headingId: string; className?: string }) {
  return (
    <div className={cn("relative z-20", frauncesItalic.variable, className)}>
      <h1
        id={headingId}
        className="font-serif text-[clamp(2.45rem,9.6vw,3.7rem)] font-[450] leading-[1.02] tracking-[-0.022em] text-[#101827] lg:text-[clamp(3.3rem,5.4vw,5.9rem)]"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0' }}
      >
        <span className="nw-sig-line">
          <span>{HERO_COPY.headlineLead}</span>
        </span>
        <span className="nw-sig-line">
          <span>
            <em className="font-[family-name:var(--font-fraunces-italic)] font-[420] not-italic [font-style:italic]" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0' }}>
              {HERO_COPY.headlineEmphasis}
            </em>
          </span>
        </span>
      </h1>
      <p className="nw-sig-settle mt-5 max-w-[26rem] text-[1.02rem] leading-relaxed text-[#566174] sm:text-[1.08rem] lg:mt-7 lg:max-w-[30rem] lg:text-[1.15rem]">{HERO_COPY.body}</p>
      <div className="nw-sig-settle mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 lg:mt-9 lg:gap-x-7">
        <Link
          href={HERO_ACTIONS.primary.href}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#1454D9] px-6 text-[0.98rem] font-semibold text-white shadow-[0_10px_24px_-14px_rgba(20,84,217,0.9)] transition-colors duration-200 hover:bg-[#1759F3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1454D9] motion-reduce:transition-none"
        >
          {HERO_ACTIONS.primary.label}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
        <Link
          href={HERO_ACTIONS.secondary.href}
          className="inline-flex min-h-[44px] items-center text-[0.98rem] font-semibold text-[#101827] underline decoration-[#101827]/25 decoration-1 underline-offset-[6px] transition-colors duration-200 hover:decoration-[#1454D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1454D9] motion-reduce:transition-none"
        >
          {HERO_ACTIONS.secondary.label}
        </Link>
      </div>
    </div>
  );
}
