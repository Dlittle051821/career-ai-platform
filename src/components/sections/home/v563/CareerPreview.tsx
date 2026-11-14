"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { CAREER_EXPLORER_HREF, type CareerArtwork, type CareerPreviewItem } from "@/lib/home/v563/career-preview";

/**
 * NW-V5.6.3 — the Career Intelligence preview (homepage scene 3).
 *
 * A small, self-contained demonstration: three illustrative careers behind an
 * accessible tablist (click, tap, arrow keys, Home/End). Every panel is always
 * rendered at a fixed size and cross-faded with opacity/transform only, so
 * switching never shifts layout; inactive panels are inert and hidden from
 * assistive tech. No scroll listeners and no timers: the V5.4 engine still owns
 * the scene's reveal and the chapter navigation, and the ambient artwork motion
 * is pure CSS that pauses whenever this chapter is not on screen.
 *
 * Illustrative only: the same for every visitor, never a recommendation.
 */
export function CareerPreview({ items }: { items: CareerPreviewItem[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = useCallback((i: number, focus = false) => {
    setActive(i);
    if (focus) tabs.current[i]?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = items.length;
    let j = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (active + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (active - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    e.stopPropagation(); // the chapter controller must not read these as story navigation
    select(j, true);
  };

  return (
    <div className="ci563" data-ci-active={items[active]?.key}>
      <CareerBackdrop />
      <div className="ci-card">
        <div className="ci-top">
          <span className="ci-kicker">Career Intelligence</span>
          <span className="ci-illu">Illustrative career profile</span>
        </div>

        <div className="ci-tabs" role="tablist" aria-label="Example careers" onKeyDown={onKeyDown}>
          {items.map((c, i) => (
            <button
              key={c.key}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`ci563-tab-${c.key}`}
              aria-controls={`ci563-panel-${c.key}`}
              aria-selected={i === active}
              tabIndex={i === active ? 0 : -1}
              className="ci-tab"
              data-ci-tab={c.key}
              onClick={() => select(i)}
            >
              <TabIcon kind={c.key} />
              <span>{c.tab}</span>
            </button>
          ))}
          <span className="ci-tab-ink" aria-hidden="true" style={{ transform: `translateX(${active * 100}%)` }} />
        </div>

        <div className="ci-panels">
          {items.map((c, i) => {
            const on = i === active;
            return (
              <div
                key={c.key}
                className="ci-panel"
                role="tabpanel"
                id={`ci563-panel-${c.key}`}
                aria-labelledby={`ci563-tab-${c.key}`}
                data-on={on ? "" : undefined}
                inert={!on}
              >
                <div className="ci-hero">
                  <CareerArt kind={c.key} />
                  <ul className="ci-tags" aria-label="Topics">
                    {c.tags.map((t, k) => (
                      <li key={t} style={{ transitionDelay: on ? `${120 + k * 45}ms` : "0ms" }}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <h3 className="ci-title">{c.title}</h3>
                <div className="ci-inv">{c.invitation}</div>
                <div className="ci-grid">
                  <div className="ci-tile ci-tile-wide">
                    <div className="ci-k">What the work involves</div>
                    <div className="ci-v">{c.involves}</div>
                  </div>
                  <div className="ci-tile">
                    <div className="ci-k">Key skill areas</div>
                    <ul className="ci-chips">
                      {c.skills.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="ci-tile ci-dOnly">
                    <div className="ci-k">Academic foundations</div>
                    <div className="ci-v">
                      {c.foundations.subjects.join(" · ")}
                      {c.foundations.route ? <span className="ci-route">{c.foundations.route}</span> : null}
                    </div>
                  </div>
                  <div className="ci-tile ci-tile-wide ci-tile-row ci-dOnly">
                    <div className="ci-k">Related careers</div>
                    <ul className="ci-chips ci-chips-line">
                      {c.related.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ci-foot">
          <div className="ci-src">
            From the verified{" "}
            <Link href={items[active]!.profileHref} className="ci-src-link">
              {items[active]!.profileTitle} profile
            </Link>
          </div>
          <Link href={CAREER_EXPLORER_HREF} className="ci-cta">
            Explore Career Paths
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M2 8h11M9 3.5 13.5 8 9 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Behind the card: layered translucent panels, quiet domain labels, directional lines, soft light. Decorative only. */
function CareerBackdrop() {
  return (
    <div className="ci-bg" aria-hidden="true">
      <div className="ci-glow" />
      <div className="ci-sheet ci-sheet-1">
        <span>Discover</span>
      </div>
      <div className="ci-sheet ci-sheet-2" />
      <svg className="ci-lines" viewBox="0 0 700 720" preserveAspectRatio="none" focusable="false">
        <path d="M-20 640 C 140 610, 220 520, 300 470" />
        <path d="M720 120 C 640 150, 600 210, 560 260" />
        <circle cx="300" cy="470" r="3.5" />
        <circle cx="560" cy="260" r="3.5" />
      </svg>
      <span className="ci-float ci-float-1">Understand</span>
      <span className="ci-sheet-label">Explore</span>
      <span className="ci-float ci-float-2">
        Your next direction <i>→</i>
      </span>
    </div>
  );
}

function TabIcon({ kind }: { kind: CareerArtwork }) {
  const d =
    kind === "robotics"
      ? "M5 19h8M9 19v-5l5-4 4 2M14 10l-1-4m-1 0h2.5M18 12l2 2"
      : kind === "energy"
        ? "M12 12v8M12 12l-6-3M12 12l6-3M12 12V4M9 20h6"
        : "M4 15c4-8 12-10 16-10-1 4-3 12-11 15M9 15l-3 3M14 6l4 4";
  return (
    <svg className="ci-tab-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Original line illustrations on a technical grid (Nextwise palette). Decorative. */
function CareerArt({ kind }: { kind: CareerArtwork }) {
  return (
    <svg className={`ci-art ci-art-${kind}`} viewBox="0 0 600 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`ci563-bg-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#03045F" />
          <stop offset="1" stopColor={kind === "energy" ? "#035C8E" : kind === "space" ? "#0A1A6B" : "#0077B6"} />
        </linearGradient>
        <radialGradient id={`ci563-lt-${kind}`} cx="72%" cy="38%" r="55%">
          <stop offset="0" stopColor="#00B4D8" stopOpacity=".38" />
          <stop offset="1" stopColor="#00B4D8" stopOpacity="0" />
        </radialGradient>
        <pattern id={`ci563-grid-${kind}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#90E0EF" strokeOpacity=".1" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="600" height="120" fill={`url(#ci563-bg-${kind})`} />
      <rect width="600" height="120" fill={`url(#ci563-grid-${kind})`} />
      <rect width="600" height="120" fill={`url(#ci563-lt-${kind})`} />
      {/* the illustrations are drawn on a 600 × 220 board and placed on the right of the band */}
      <g transform="translate(250 -6) scale(.56)">{kind === "robotics" ? <RoboticsArt /> : kind === "energy" ? <EnergyArt /> : <SpaceArt />}</g>
    </svg>
  );
}

const LINE = { fill: "none", stroke: "#CAF0F8", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function RoboticsArt() {
  return (
    <g transform="translate(330 0)">
      {/* sensing field */}
      <g className="ci-pulse" fill="none" stroke="#00B4D8" strokeOpacity=".55">
        <path d="M150 74 a52 52 0 0 1 0 72" />
        <path d="M168 60 a74 74 0 0 1 0 100" />
      </g>
      {/* base */}
      <path {...LINE} d="M20 196h96M36 196v-14h64v14" />
      {/* articulated arm */}
      <g className="ci-arm">
        <path {...LINE} d="M68 182 L 92 118" />
        <circle cx="68" cy="182" r="9" fill="#03045F" stroke="#CAF0F8" strokeWidth="2.2" />
        <g className="ci-forearm">
          <path {...LINE} d="M92 118 L 150 104" />
          <circle cx="92" cy="118" r="8" fill="#03045F" stroke="#CAF0F8" strokeWidth="2.2" />
          <path {...LINE} d="M150 104 l14 -10 M150 104 l16 6" />
          <circle cx="150" cy="104" r="5" fill="#FF4D6D" />
        </g>
      </g>
      {/* a small decision graph: the autonomy */}
      <g stroke="#90E0EF" strokeOpacity=".6" strokeWidth="1.4">
        <path d="M-150 60 L -100 40 L -50 70 L -100 100 Z M-100 40 L -100 100" fill="none" />
      </g>
      <g fill="#90E0EF">
        <circle cx="-150" cy="60" r="4" />
        <circle cx="-100" cy="40" r="4" />
        <circle cx="-50" cy="70" r="4" />
        <circle cx="-100" cy="100" r="4" fill="#FF4D6D" />
      </g>
    </g>
  );
}

function EnergyArt() {
  return (
    <g>
      {/* turbine */}
      <path {...LINE} d="M470 200 L 476 92 M482 200 L 476 92" />
      <g className="ci-rotor">
        <path {...LINE} d="M476 88 L 476 34 M476 88 L 523 115 M476 88 L 429 115" />
      </g>
      <circle cx="476" cy="88" r="5" fill="#FF4D6D" />
      {/* solar array */}
      <g stroke="#CAF0F8" strokeWidth="1.8" fill="none">
        <path d="M340 180 L 404 160 L 430 186 L 366 206 Z" />
        <path d="M361 173.5 L 387 199.5 M382 167 L 408 193 M353 193 L 417 173" />
      </g>
      {/* grid line with nodes */}
      <path className="ci-flow" d="M60 150 C 140 120, 200 170, 280 140 S 380 110, 420 120" fill="none" stroke="#00B4D8" strokeWidth="2" strokeDasharray="5 8" />
      <g fill="#90E0EF">
        <circle cx="60" cy="150" r="4" />
        <circle cx="180" cy="148" r="4" />
        <circle cx="280" cy="140" r="4" />
      </g>
    </g>
  );
}

function SpaceArt() {
  return (
    <g>
      {/* planet limb */}
      <path d="M-20 230 C 120 170, 300 160, 620 210" fill="none" stroke="#90E0EF" strokeOpacity=".5" strokeWidth="1.6" />
      {/* orbit */}
      <ellipse cx="400" cy="112" rx="170" ry="52" fill="none" stroke="#00B4D8" strokeOpacity=".55" strokeWidth="1.6" strokeDasharray="4 7" />
      <circle className="ci-pulse" cx="570" cy="112" r="4.5" fill="#FF4D6D" />
      {/* satellite */}
      <g className="ci-bob">
      <g transform="translate(372 86) rotate(-14)">
        <rect x="18" y="10" width="20" height="28" rx="3" fill="#03045F" stroke="#CAF0F8" strokeWidth="2.2" />
        <rect x="-34" y="16" width="46" height="16" fill="none" stroke="#CAF0F8" strokeWidth="1.8" />
        <rect x="44" y="16" width="46" height="16" fill="none" stroke="#CAF0F8" strokeWidth="1.8" />
        <path d="M-11 16v16M67 16v16M12 24h6M38 24h6M28 10V0" stroke="#CAF0F8" strokeWidth="1.6" />
        <circle cx="28" cy="-3" r="3" fill="#90E0EF" />
      </g>
      </g>
      {/* stars */}
      <g fill="#CAF0F8">
        <circle cx="80" cy="40" r="1.6" />
        <circle cx="150" cy="80" r="1.2" />
        <circle cx="230" cy="30" r="1.8" />
        <circle cx="300" cy="64" r="1.2" />
        <circle cx="540" cy="36" r="1.5" />
      </g>
    </g>
  );
}
