import Image from "next/image";
import { V54_CARDS, V54_COPY } from "@/lib/home/v54/config";
import { ThoughtCard } from "./ThoughtCard";
import { V54PrimaryCta } from "./V54Account";

const PORTRAIT = { src: "/home-v54/v54-portrait.png", width: 1860, height: 1174 };

/** The Future Horizon scene: an original rendered landscape (no people), served as responsive AVIF / WebP / JPEG. */
const SCENE = "/home-v54/v54-horizon";
const srcSet = (layout: "desktop" | "mobile", ext: string, widths: number[]) => widths.map((w) => `${SCENE}-${layout}-${w}.${ext} ${w}w`).join(", ");

/**
 * The Future Horizon: a faint aspirational horizon behind the student. V5.4
 * renders it in the full-bleed backdrop (edge to edge, behind the stage)
 * instead of inside the old page frame. Only the image is translucent; it is
 * masked so the headline area stays light.
 */
const PORTRAIT_MEDIA = "(max-width: 699.98px), (max-aspect-ratio: 86/100)";
export function HorizonScene() {
  return (
    <div className="v54-scene" data-v54-scene="" aria-hidden="true">
      <picture>
        <source media={PORTRAIT_MEDIA} type="image/avif" srcSet={srcSet("mobile", "avif", [780, 1170])} sizes="100vw" />
        <source media={PORTRAIT_MEDIA} type="image/webp" srcSet={srcSet("mobile", "webp", [780, 1170])} sizes="100vw" />
        <source media={PORTRAIT_MEDIA} srcSet={`${SCENE}-mobile-780.jpg`} />
        <source type="image/avif" srcSet={srcSet("desktop", "avif", [1440, 2160, 2880])} sizes="100vw" />
        <source type="image/webp" srcSet={srcSet("desktop", "webp", [1440, 2160, 2880])} sizes="100vw" />
        {/* a plain <img> inside an art-directed <picture>: next/image cannot switch crops per breakpoint */}
        <img src={`${SCENE}-desktop-1440.jpg`} alt="" width={1440} height={900} decoding="async" fetchPriority="low" draggable={false} />
      </picture>
    </div>
  );
}

/**
 * NW-V5.4 — the organic-motion hero (scene L0 of the V4 stage), with the
 * Future Horizon background, technology typography and Electric Coral on
 * the primary actions only.
 *
 * Layers, back to front: paper + glow → the faint Future Horizon scene →
 * question cards that are behind the
 * student (z < 0) → the portrait (alpha cut-out, so his head genuinely hides
 * them) → the clarity veil → cards in front of him → eyebrow, headline, copy
 * and actions. There is no ring or guide: every card follows its own
 * authored path. Every card is real HTML; the ThoughtMotionController
 * moves them.
 */
export function NextwiseV54Hero() {
  return (
    <section className="nw4-layer L0" id="nw4-scene-0" aria-label="Too many choices. One clearer direction.">
      <div className="glow" data-nw4-glow="" />
      <div className="v54-hero-layers">
        <div className="a ph h-photo v54-portrait" data-nw4-hero-photo="" style={{ background: "none" }}>
          <i>
            <Image
              src={PORTRAIT.src}
              alt="A young man with dark curly hair tilts his head back with his eyes closed, thinking about what comes next"
              width={PORTRAIT.width}
              height={PORTRAIT.height}
              priority
              sizes="(max-width: 699.98px) min(157vw, 72.7vh), (max-aspect-ratio: 86/100) 72.7vh, min(58.6vw, 93.8vh)"
              draggable={false}
            />
            {/* V5.4: without the old page frame the torso must reach the bottom of the screen — the portrait's own
                bottom row, stretched (public/home-v54/v54-portrait-base.png is built from rows 1140–1150 of the approved portrait) */}
            <span className="v54-portrait-base" aria-hidden="true" />
          </i>
        </div>
        <div className="v54-veil" data-v54-veil="" aria-hidden="true" />

        <ul className="v54-thoughts" aria-label="Questions students ask before they find a clear direction">
          {V54_CARDS.map((c) => (
            <ThoughtCard key={c.id} card={c} />
          ))}
        </ul>
        <div className="v54-label v54-label-career" data-v54-label="career" aria-hidden="true">
          <i />
          <span className="v54-lp">Organised by&nbsp;</span>
          {V54_COPY.columns.career}
        </div>
        <div className="v54-label v54-label-abroad" data-v54-label="abroad" aria-hidden="true">
          <i />
          <span className="v54-lp">Organised by&nbsp;</span>
          {V54_COPY.columns.abroad}
        </div>

        <p className="a v54-eyebrow" data-sec="0" data-intro="3500">
          <i aria-hidden="true" />
          {V54_COPY.eyebrow}
        </p>
        <h1 className="a h-hero h-h1 v54-h1" data-sec="0">
          <span className="ln">
            <span data-line="0">
              {V54_COPY.headline[0].replace(/\.$/, "")}
              <span className="v54-p">.</span>
            </span>
          </span>{" "}
          <span className="ln">
            <span data-line="1" className="v54-accent">
              {V54_COPY.headline[1]}
              <span className="v54-p">{V54_COPY.headlineStop}</span>
            </span>
          </span>
        </h1>
        <p className="a v54-sub" data-sec="0" data-intro="3600">
          {V54_COPY.support}
        </p>
        <div className="a v54-cta" data-sec="0" data-intro="3800">
          <V54PrimaryCta label={V54_COPY.primary} />
          <button type="button" className="v54-btn v54-btn-ghost" data-v54-tour="" aria-describedby="v54-tour-hint">
            <span className="v54-play" aria-hidden="true" />
            {V54_COPY.secondary}
          </button>
          <span id="v54-tour-hint" className="v54-sr">Plays a guided scroll through the homepage story. Scroll or press any key to stop.</span>
        </div>

        <div className="v54-badge dOnly" data-v54-fade="" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <defs>
              <path id="v54-badge-circle" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
            </defs>
            <g className="v54-badge-spin">
              <text fontSize="9.6" letterSpacing="3.4" fill="#03045F">
                <textPath href="#v54-badge-circle">{V54_COPY.badge}</textPath>
              </text>
            </g>
            <path className="v54-badge-star" d="M60 46 L63 57 L74 60 L63 63 L60 74 L57 63 L46 60 L57 57 Z" />
          </svg>
        </div>
        <div className="v54-trust dOnly" data-v54-fade="">
          <i aria-hidden="true" />
          <p>{V54_COPY.trust}</p>
          <span className="v54-roles" aria-hidden="true">
            <b>Students</b>
            <b>Parents</b>
            <b>Counsellors</b>
          </span>
        </div>
        <div className="v54-note dOnly" data-v54-fade="">
          <p>
            <i aria-hidden="true" />
            {V54_COPY.signature}
          </p>
        </div>
      </div>
    </section>
  );
}
