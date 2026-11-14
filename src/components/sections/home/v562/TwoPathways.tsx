import Link from "next/link";
import {
  BINOCULARS,
  BINOCULAR_SIZES,
  CARD_LABELS,
  CHIPS,
  CHIP_ICON,
  LENSES,
  V562_COPY,
  V562_ROUTES,
  binocularSrcSet,
  trailFor,
} from "@/lib/home/v562/content";

/**
 * NW-V5.6.2 — "Where are you in your journey?" (approved object-only Two Pathways).
 *
 * Rendered inside V5.4 backdrop panel 1 (screen space, edge to edge). Server
 * rendered: both pathways are real links to existing routes and every word is
 * readable without JavaScript. The objects are original, decorative and
 * aria-hidden: the Dreamscape Binoculars (an original three.js render with
 * live SVG lens viewports, branching trails and career-field chips) and the
 * Journey Ticket (HTML/SVG route cards and ticket). Motion:
 * src/lib/home/v562/two-pathways.ts.
 */

const ROUTE_D = "M8 26 C 80 26 90 10 150 12 S 240 24 292 14";

function LensScene() {
  return (
    <>
      <g className="ls-pan">
        <rect x="-260" y="-140" width="520" height="280" fill="url(#tp562-sky)" />
        <g fill="#CAF0F8">
          <circle cx="-160" cy="-70" r="1.6" />
          <circle cx="-90" cy="-95" r="1.2" />
          <circle cx="-30" cy="-60" r="1.8" />
          <circle cx="40" cy="-88" r="1.3" />
          <circle cx="110" cy="-66" r="1.7" />
          <circle cx="170" cy="-92" r="1.2" />
          <circle cx="-130" cy="-30" r="1" />
          <circle cx="80" cy="-35" r="1.1" />
        </g>
        <path d="M-260 -8 C-150 -20 -60 0 20 -12 S170 -22 260 -10 L260 140 L-260 140Z" fill="url(#tp562-ground)" />
        <path d="M-260 -8 C-150 -20 -60 0 20 -12 S170 -22 260 -10" fill="none" stroke="#90E0EF" strokeOpacity=".6" strokeWidth="1.4" />
        <g transform="translate(0 -26)" fill="none" stroke="#90E0EF" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="4 7">
          <path className="r" d="M0 120 C -10 80 -40 60 -95 40" />
          <path className="r" d="M0 120 C 5 80 30 60 70 38" />
          <path className="r" d="M0 120 C 0 70 -5 50 -20 24" />
          <path className="r" d="M-95 40 C -130 30 -160 28 -190 24" />
          <path className="r" d="M70 38 C 110 30 150 26 200 22" />
          <path className="r" d="M-20 24 C -25 10 -10 0 15 -6" />
        </g>
        <g transform="translate(0 -26)">
          <g transform="translate(-95 40)">
            <circle r="5" fill="#00B4D8" />
            <circle r="10" fill="none" stroke="#90E0EF" strokeOpacity=".5" />
          </g>
          <g transform="translate(70 38)">
            <circle r="5" fill="#00B4D8" />
            <circle r="10" fill="none" stroke="#90E0EF" strokeOpacity=".5" />
          </g>
          <circle cx="-20" cy="24" r="4" fill="#CAF0F8" />
          <circle cx="-190" cy="24" r="4" fill="#90E0EF" />
          <circle cx="200" cy="22" r="4" fill="#90E0EF" />
          <path transform="translate(15 -6)" d="M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6Z" fill="#CAF0F8" />
        </g>
      </g>
      <circle r="100" fill="url(#tp562-gloss)" />
    </>
  );
}

/** The CTA arrow is drawn, not typed: identical in every browser (a "→" glyph falls back to different fonts). */
function Arrow() {
  return (
    <span className="tp-cta-arrow" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        <path d="M2 8h11M9 3.5 13.5 8 9 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function TwoPathways() {
  const d = V562_COPY.discovery;
  const c = V562_COPY.clarity;
  const trails = CHIPS.map(([, , x, y]) => trailFor(x, y));
  return (
    <div className="tp562" data-tp="" data-tp-mode="rest" data-tp-layout="split">
      <svg className="tp-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="tp562-sky" cx="50%" cy="38%" r="70%">
            <stop offset="0" stopColor="#0B4FA0" />
            <stop offset=".55" stopColor="#062A78" />
            <stop offset="1" stopColor="#03045F" />
          </radialGradient>
          <linearGradient id="tp562-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0077B6" stopOpacity=".55" />
            <stop offset="1" stopColor="#03045F" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="tp562-gloss" cx="30%" cy="22%" r="60%">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset=".4" stopColor="#fff" stopOpacity=".06" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      <div className="tp-label">
        <p className="tp-kicker">{V562_COPY.kicker}</p>
        <h2 className="tp-title" id="tp562-title">
          {V562_COPY.title}
        </h2>
      </div>

      {/* PATHWAY 01 — DISCOVERY */}
      <article className="tp-field tp-field-d" data-tp-path="discovery" aria-labelledby="tp562-h-d">
        <div className="tp-duo tp-duo-d" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative vector for the desktop detail view; loaded on first use (two-pathways.ts) */}
          <img data-tp-src="/home-v562/contours.svg" alt="" decoding="async" width={1600} height={1200} />
        </div>
        <div className="tp-inner">
          <div className="tp-box">
            <div className="tp-obj tp-disc" aria-hidden="true">
              <svg className="tp-trails" viewBox="0 0 1000 700" preserveAspectRatio="none" focusable="false">
                {trails.map((t, i) => (
                  <g key={i}>
                    <path className="tp-trail" d={t.d} />
                    <circle className="tp-tnode" cx={t.end[0]} cy={t.end[1]} r="5" opacity="0" />
                  </g>
                ))}
              </svg>
              <div className="tp-binoc">
                <picture>
                  <source type="image/avif" srcSet={binocularSrcSet("avif")} sizes={BINOCULAR_SIZES} />
                  <img
                    className="tp-binoc-img"
                    src={`${BINOCULARS.base}-1280.webp`}
                    srcSet={binocularSrcSet("webp")}
                    sizes={BINOCULAR_SIZES}
                    width={BINOCULARS.w}
                    height={BINOCULARS.h}
                    alt=""
                    decoding="async"
                    loading="lazy"
                    fetchPriority="low"
                  />
                </picture>
                {LENSES.map((l, i) => (
                  <svg
                    key={i}
                    className="tp-lens"
                    style={{ left: `${l.left}%`, top: `${l.top}%`, width: `${l.width}%`, height: `${l.height}%`, transform: `rotate(${l.rot}deg)` }}
                    viewBox="-100 -100 200 200"
                    preserveAspectRatio="none"
                    focusable="false"
                  >
                    <LensScene />
                  </svg>
                ))}
              </div>
              <div className="tp-chips-d">
                {CHIPS.map(([label, icon, x, y]) => (
                  <span key={label} className="tp-pchip" style={{ left: `${((x / 691) * 100).toFixed(3)}%`, top: `${((y / 497) * 100).toFixed(3)}%` }}>
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d={CHIP_ICON[icon]} />
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="tp-copy">
              <p className="tp-eyebrow">
                <span className="tp-num">{d.num}</span>
                <span className="tp-dot" aria-hidden="true" />
                {d.eyebrow}
              </p>
              <h3 className="tp-headline" id="tp562-h-d">
                <span className="tp-ln">
                  <span>{d.lines[0]}</span>
                </span>{" "}
                <span className="tp-ln">
                  <span>{d.lines[1]}</span>
                </span>
              </h3>
              <p className="tp-identity">{d.identity}</p>
              <p className="tp-desc">{d.text}</p>
              <ul className="tp-list" aria-label="What you will do">
                {d.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="tp-cta" href={V562_ROUTES.discovery} data-tp-cta="discovery">
                <span className="tp-cta-fill" aria-hidden="true" />
                <span className="tp-cta-label">{d.cta}</span>
                <Arrow />
              </Link>
            </div>
          </div>
        </div>
        <button type="button" className="tp-strip tp-strip-d" data-tp-strip="discovery" aria-label="Switch to Discovery" tabIndex={-1} aria-hidden="true">
          <span aria-hidden="true">‹</span>
          <em aria-hidden="true">01 · Discovery</em>
        </button>
      </article>

      {/* PATHWAY 02 — CLARITY */}
      <article className="tp-field tp-field-c" data-tp-path="clarity" aria-labelledby="tp562-h-c">
        <div className="tp-duo tp-duo-c" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative vector for the desktop detail view; loaded on first use (two-pathways.ts) */}
          <img data-tp-src="/home-v562/europe.svg" alt="" decoding="async" width={1600} height={1200} />
        </div>
        <div className="tp-inner">
          <div className="tp-box">
            <div className="tp-obj tp-jt" aria-hidden="true">
              {[2, 1, 0].map((i) => {
                const card = CARD_LABELS[i]!;
                return (
                  <div key={card.tag} className="tp-jt-card" data-tp-card={i}>
                    <span className="tp-jt-tag">
                      <i className={`tp-ic tp-ic-${card.icon}`} />
                      {card.tag}
                    </span>
                    <b />
                    <b className="s" />
                    <span className="tp-jt-n">{card.n}</span>
                  </div>
                );
              })}
              <div className="tp-jt-ticket">
                <div className="tp-jt-main">
                  <div className="tp-jt-head">
                    <span>NEXTWISE</span>
                    <em>/ YOUR JOURNEY</em>
                  </div>
                  <p className="tp-jt-you">
                    YOU <span className="tp-jt-arrow">→</span>
                  </p>
                  <p className="tp-jt-dest">
                    WHERE YOU
                    <br />
                    WANT TO GO
                  </p>
                  <svg className="tp-jt-route" viewBox="0 0 300 40" preserveAspectRatio="none" focusable="false">
                    <path className="tp-jt-track" d={ROUTE_D} />
                    <path className="tp-jt-prog" d={ROUTE_D} />
                    <circle className="tp-jt-o" cx="8" cy="26" r="5" />
                    <circle className="tp-jt-s" data-tp-stop="1" cx="100" cy="15" r="4" />
                    <circle className="tp-jt-s" data-tp-stop="2" cx="200" cy="18" r="4" />
                    <g className="tp-jt-d" transform="translate(292 14)">
                      <circle r="7" />
                      <circle className="ring" r="13" />
                    </g>
                    <circle className="tp-jt-dot" cx="8" cy="26" r="4.5" />
                  </svg>
                  <p className="tp-jt-legend">
                    <span>01 · Country</span>
                    <span>02 · University</span>
                    <span>03 · Programme</span>
                  </p>
                </div>
                <div className="tp-jt-stub">
                  <span>
                    DISCOVER YOUR
                    <br />
                    STUDY PATH
                  </span>
                  <svg viewBox="0 0 40 40" focusable="false">
                    <circle cx="20" cy="20" r="15" fill="none" stroke="#90E0EF" strokeWidth="2" />
                    <path d="M11 25 Q17 9 29 15" fill="none" stroke="#90E0EF" strokeWidth="2" />
                    <circle cx="29" cy="15" r="3.4" fill="#FF4D6D" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="tp-copy">
              <span className="tp-float" aria-hidden="true" />
              <p className="tp-eyebrow">
                <span className="tp-num">{c.num}</span>
                <span className="tp-dot" aria-hidden="true" />
                {c.eyebrow}
              </p>
              <h3 className="tp-headline" id="tp562-h-c">
                <span className="tp-ln">
                  <span>{c.lines[0]}</span>
                </span>{" "}
                <span className="tp-ln">
                  <span>{c.lines[1]}</span>
                </span>
              </h3>
              <p className="tp-identity">{c.identity}</p>
              <p className="tp-desc">{c.text}</p>
              <p className="tp-countries">
                <span className="tp-sr">Launch destinations: </span>
                {c.countries.join(" · ")}
              </p>
              <Link className="tp-cta" href={V562_ROUTES.clarity} data-tp-cta="clarity">
                <span className="tp-cta-fill" aria-hidden="true" />
                <span className="tp-cta-label">{c.cta}</span>
                <Arrow />
              </Link>
            </div>
          </div>
        </div>
        <button type="button" className="tp-strip tp-strip-c" data-tp-strip="clarity" aria-label="Switch to Clarity" tabIndex={-1} aria-hidden="true">
          <span aria-hidden="true">›</span>
          <em aria-hidden="true">02 · Clarity</em>
        </button>
      </article>

      <div className="tp-seam" aria-hidden="true">
        <span className="tp-chev l">‹</span>
        <span className="tp-chev r">›</span>
      </div>
      <div className="tp-counter" aria-hidden="true">
        <span className="tp-c1">01</span>
        <span className="tp-bar">
          <i />
        </span>
        <span className="tp-c2">02</span>
        <span className="tp-clabel">Both pathways</span>
      </div>
      <p className="tp-hint" aria-hidden="true">
        {V562_COPY.hint}
      </p>
      <button type="button" className="tp-back" data-tp-back="" aria-label="Back to both pathways" tabIndex={-1} aria-hidden="true">
        {V562_COPY.back}
      </button>
    </div>
  );
}
