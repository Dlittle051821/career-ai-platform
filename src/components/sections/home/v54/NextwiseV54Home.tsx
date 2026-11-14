import Link from "next/link";
import { BRAND_LOGO } from "@/config/site";
import {
  V4_CAREER_TABS,
  V4_DESTINATIONS,
  V4_PILLARS,
  V4_ROUTES,
  V4_SCENES,
  V4_TRUST_STATEMENT,
  coursesForDestination,
} from "@/lib/home/v4/content";
import {
  V4_DESTINATION_IMAGES,
  coverWidth,
  desktopSizes,
  finalBg,
  mobileSizes,
} from "@/lib/home/v4/images";
import { V4Picture } from "@/components/sections/home/v4/V4Picture";
import "@/components/sections/home/v4/v4-home.css";
import { v54Grotesk, v54Sora } from "./fonts";
import { HorizonScene, NextwiseV54Hero } from "./NextwiseV54Hero";
import { V54AccountProvider } from "./V54Account";
import { SiteHeader } from "@/components/navigation/Header";
import { V54Motion } from "./V54Motion";
import "./v54.css";
import { TwoPathways } from "../v562/TwoPathways";
import { TwoPathwaysMotion } from "../v562/TwoPathwaysMotion";
import "../v562/two-pathways.css";
import { CareerPreview } from "../v563/CareerPreview";
import "../v563/career-intelligence.css";
import { buildCareerPreview } from "@/lib/home/v563/career-preview";

const Arrow = () => (
  <span className="ar" aria-hidden="true">
    →
  </span>
);

const SCENE_LINKS = [
  { go: V4_SCENES.pathways, label: "Where are you in your journey?" },
  { go: V4_SCENES.careers, label: "Career Intelligence" },
  { go: V4_SCENES.abroad, label: "Study Abroad destination explorer" },
  { go: V4_SCENES.studio, label: "Student Studio" },
  { go: V4_SCENES.trust, label: "How we guide you" },
  { go: V4_SCENES.final, label: "Start exploring" },
] as const;

const ROOT_ID = "nw54";

/**
 * NW-V5.4 — the approved V5.3 landing page as a full-screen experience.
 * Scene 2 is the approved V5.6.2 "Where are you in your journey?" (Two
 * Pathways, object-only), rendered in backdrop panel 1; every other scene,
 * the hero, the N, the header and the engine are V5.4's, unchanged.
 *
 * Server-rendered markup on the V4 stage contract. V54Motion starts the
 * approved engine (V5.4 fork: stage rule + delegated navigation only), the
 * thought-card controller, the full-bleed backdrop and the chapter
 * controller (one scroll gesture → one complete chapter). The header uses
 * Electric Coral pills for navigation hover/focus and separates "Log in"
 * from "Sign up"; the account state comes from the existing auth hook.
 */

/** V5.6.3 — built once at render time from the verified career records (server side). */
const CAREER_PREVIEW = buildCareerPreview();

export function NextwiseV54Home() {
  const words = V4_TRUST_STATEMENT.split(/\s+/);

  return (
    <div id={ROOT_ID} className={`nw4 nw54 ${v54Grotesk.variable} ${v54Sora.variable}`} data-nw4-root="" data-nw54-root="" data-v54-state="intro" data-v54-type="a" data-v54-chapter="hero">
      <V54Motion rootId={ROOT_ID} />
      <TwoPathwaysMotion rootId={ROOT_ID} />
      <V54AccountProvider>
      {/* CIUX-01B: the global Nextwise header (the same component as every other page). */}
      <SiteHeader context="home" rootId={ROOT_ID} />
      <p className="v54-sr" aria-live="polite" data-v54-live="" />
      <nav className="nw4-skipnav" aria-label="Homepage sections">
        <ul>
          {SCENE_LINKS.map((s) => (
            <li key={s.go}>
              <a href={`#nw4-scene-${s.go}`} data-go={s.go}>
                Go to: {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="nw4-scroller" data-nw4-scroller="">
        <div className="nw4-sticky" data-nw4-sticky="">
          {/* V5.4: every scene's background, edge to edge behind the stage (driven by src/lib/home/v54/backdrop.ts) */}
          <div className="v54-backdrop" data-v54-backdrop="">
            {[0, 1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className={`v54-panel v54-p${j}`} data-v54-panel={j} aria-hidden={j === 1 ? undefined : true}>
                {j === 0 ? <HorizonScene /> : null}
                {j === 1 ? <TwoPathways /> : null}
              </div>
            ))}
          </div>
          <div className="nw4-stage d" data-nw4-stage="">
            {/* 01 THE APPROVED V5 HERO */}
            <NextwiseV54Hero />

            {/* 02 TWO PATHWAYS — V5.6.2: the scene lives in backdrop panel 1 (screen space, see v562/TwoPathways.tsx); this layer keeps the engine's scene slot */}
            <section className="nw4-layer L1" id="nw4-scene-1" aria-labelledby="tp562-title" />

            {/* 03 CAREER INTELLIGENCE */}
            <section className="nw4-layer L2" id="nw4-scene-2" aria-label="Career Intelligence">
              <div className="a eb c-eb" data-sec="2" data-i="0">
                Career Intelligence
              </div>
              <h2 className="a serif h2 c-h2" data-sec="2" data-i="0">
                <span className="ln">
                  <span>Discover a direction</span>
                </span>
                <span className="ln">
                  <span>
                    <em>that fits you.</em>
                  </span>
                </span>
              </h2>
              <p className="a c-body" data-sec="2" data-i="1">
                Reflect on what you enjoy and what you&apos;re good at, then explore careers in depth — what the work involves, how people get in, and what to do next.
              </p>
              <div className="a steps c-steps" data-sec="2" data-i="2">
                <div className="row">
                  <span className="n">01</span>
                  <div>
                    <b>Reflect</b>
                    <span>Questions about your interests, strengths and values.</span>
                  </div>
                </div>
                <div className="row">
                  <span className="n">02</span>
                  <div>
                    <b>Explore</b>
                    <span>Career profiles: day-to-day work, entry routes and skills.</span>
                  </div>
                </div>
                <div className="row">
                  <span className="n">03</span>
                  <div>
                    <b>Plan</b>
                    <span>Save careers, compare them and set clear next steps.</span>
                  </div>
                </div>
              </div>
              <div className="a c-cta" data-sec="2" data-i="3">
                <Link className="btn forest" href={V4_ROUTES.careers}>
                  Explore Careers <Arrow />
                </Link>
              </div>
              {/* V5.6.3: the Career Intelligence preview — three illustrative careers from verified records (v563/CareerPreview) */}
              <div className="a c-app ci-host" data-sec="2" data-i="1" role="region" aria-label="Career profile preview (illustrative)">
                <CareerPreview items={CAREER_PREVIEW} />
              </div>
            </section>

            {/* 04 STUDY ABROAD — DESTINATION EXPLORER */}
            <section className="nw4-layer L3" id="nw4-scene-3" aria-label="Study Abroad destination explorer">
              <div className="a eb a-eb" data-sec="3" data-i="0">
                Study Abroad
              </div>
              <h2 className="a serif h2 a-h2" data-sec="3" data-i="0">
                <span className="ln">
                  <span>Study in Europe,</span>
                </span>
                <span className="ln">
                  <span>
                    <em>with clarity.</em>
                  </span>
                </span>
              </h2>
              <p className="a a-body" data-sec="3" data-i="1">
                Explore six destinations — programmes, course levels, tuition rules, language and application requirements — each linked to its official source.
              </p>
              <div className="a a-search" data-sec="3" data-i="2">
                <form className="search" action={V4_ROUTES.courses} method="get" role="search">
                  <label className="nw4-sr" htmlFor="nw4-q">
                    Search programmes
                  </label>
                  <input id="nw4-q" name="q" type="search" placeholder="Search programmes" autoComplete="off" />
                  <span className="lvl" role="radiogroup" aria-label="Course level">
                    <label>
                      <input type="radio" name="degree" value="bachelors" defaultChecked />
                      <span>Bachelor&apos;s</span>
                    </label>
                    <label>
                      <input type="radio" name="degree" value="masters" />
                      <span>Master&apos;s</span>
                    </label>
                  </span>
                  <button className="go" type="submit" style={{ marginLeft: 6 }}>
                    Search
                  </button>
                </form>
              </div>
              <div className="a a-list" data-sec="3" data-i="2">
                <div className="dlist" role="tablist" aria-label="Destinations">
                  {V4_DESTINATIONS.map((d, i) => (
                    <button
                      key={d.key}
                      type="button"
                      className="drow"
                      role="tab"
                      aria-selected={i === 0}
                      aria-controls="nw4-dcard"
                      tabIndex={i === 0 ? 0 : -1}
                      data-sw="country"
                      data-key={d.key}
                    >
                      <span>{d.name}</span>
                      <span className="ar" aria-hidden="true">
                        Selected →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="a a-chips mOnly" data-sec="3" data-i="1">
                <div className="dchips" role="tablist" aria-label="Destinations">
                  {V4_DESTINATIONS.map((d, i) => (
                    <button
                      key={d.key}
                      type="button"
                      role="tab"
                      aria-selected={i === 0}
                      aria-controls="nw4-dcard"
                      tabIndex={i === 0 ? 0 : -1}
                      data-sw="country"
                      data-key={d.key}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
              <Link className="a tl a-cta" href={V4_ROUTES.universities} data-sec="3" data-i="3" style={{ color: "var(--b1)" }}>
                Open the full University Explorer <Arrow />
              </Link>
              <div className="a ph dpanel a-panel" data-sec="3" data-i="1" style={{ background: "var(--b1)" }}>
                {V4_DESTINATIONS.map((d) => {
                  const img = V4_DESTINATION_IMAGES[d.key];
                  return (
                    <div key={d.key} className="dimg" data-pn="country" data-key={d.key} data-img="1">
                      <i>
                        <V4Picture
                          image={img}
                          sizes={desktopSizes(coverWidth(760, 760, img))}
                          mobileSizes={mobileSizes(coverWidth(350, 552, img))}
                          alt=""
                          objectPosition={d.objectPosition}
                        />
                      </i>
                    </div>
                  );
                })}
                <div className="dcard" id="nw4-dcard" role="tabpanel" aria-label="Destination summary" style={{ display: "grid" }}>
                  {V4_DESTINATIONS.map((d) => (
                    <div key={d.key} className="panel" data-pn="country" data-key={d.key} style={{ gridArea: "1/1", position: "static" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span className="serif" style={{ fontSize: 32, lineHeight: "36px" }}>
                          {d.name}
                        </span>
                        <span className="tag illu">Orientation summary</span>
                      </div>
                      <dl>
                        <div className="dk">
                          <dt>Course levels</dt>
                          <dd>{d.levels}</dd>
                        </div>
                        <div className="dk">
                          <dt>Tuition</dt>
                          <dd>{d.fees}</dd>
                        </div>
                        <div className="dk">
                          <dt>Teaching language</dt>
                          <dd>{d.language}</dd>
                        </div>
                        <div className="dk">
                          <dt>How to apply</dt>
                          <dd>{d.apply}</dd>
                        </div>
                        <div className="dk">
                          <dt>Official source</dt>
                          <dd>
                            <a className="src" href={d.sourceUrl} target="_blank" rel="noopener noreferrer">
                              {d.sourceLabel} ↗<span className="nw4-sr"> (opens in a new tab)</span>
                            </a>
                          </dd>
                        </div>
                      </dl>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
                        <Link className="btn sm blue" href={coursesForDestination(d.code)}>
                          Explore programmes <Arrow />
                        </Link>
                        <span style={{ fontSize: 11.5, lineHeight: "16px", color: "var(--b3)", maxWidth: 190 }} className="dOnly">
                          Always confirm details on the official source before applying.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 05 STUDENT STUDIO */}
            <section className="nw4-layer L4" id="nw4-scene-4" aria-label="Student Studio">
              <div className="a eb s-eb" data-sec="4" data-i="0">
                Student Studio
              </div>
              <h2 className="a serif h2 s-h2 center" data-sec="4" data-i="0">
                <span className="ln">
                  <span>
                    One account. <br className="mOnly" />
                    <em>Two workspaces.</em>
                  </span>
                </span>
              </h2>
              <p className="a s-sub center" data-sec="4" data-i="1">
                Save careers and programmes, track application tasks and book guidance — in one place, for you and the people supporting you.
              </p>
              <div
                className="a app s-app"
                data-sec="4"
                data-i="1"
                role="region"
                aria-label="Student Studio preview (illustrative)"
                style={{ boxShadow: "0 0 0 1px rgba(13,27,42,.06),0 40px 80px -40px rgba(13,27,42,.4)" }}
              >
                <div className="app-h" style={{ height: 60, color: "var(--t0)" }}>
                  <span className="dOnly" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    Student Studio <span className="tag illu">Illustrative UI</span>
                  </span>
                  <div className="seg" role="tablist" aria-label="Workspaces">
                    <button className="c" type="button" role="tab" aria-selected={true} tabIndex={0} data-sw="studio" data-key="career">
                      Career workspace
                    </button>
                    <button className="s" type="button" role="tab" aria-selected={false} tabIndex={-1} data-sw="studio" data-key="abroad">
                      Abroad workspace
                    </button>
                  </div>
                  <span className="dOnly" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 500, color: "var(--t2)" }}>
                    Hi, Aanya{" "}
                    <i
                      aria-hidden="true"
                      style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--p4)", display: "grid", placeItems: "center", fontStyle: "normal", fontWeight: 600, color: "var(--p1)" }}
                    >
                      A
                    </i>
                  </span>
                </div>
                <div className="s-body">
                  <div className="side dOnly" aria-hidden="true">
                    <span>Overview</span>
                    <span data-side="career">
                      <i style={{ color: "var(--f2)" }} />
                      Career workspace
                    </span>
                    <span data-side="abroad">
                      <i style={{ color: "var(--b3)" }} />
                      Abroad workspace
                    </span>
                    <span>Documents</span>
                    <span>Guidance sessions</span>
                    <span>Shared with parents</span>
                  </div>
                  <div className="panels" style={{ flex: 1 }}>
                    <div className="panel s-grid" role="tabpanel" aria-label="Career workspace" data-pn="studio" data-key="career">
                      <div className="box">
                        <h4>Saved careers</h4>
                        <div className="it">
                          <span>
                            UX Designer
                            <br />
                            <small>Design · Technology</small>
                          </span>
                          <span className="st g">Entry routes read</span>
                        </div>
                        <div className="it">
                          <span>
                            Data Analyst
                            <br />
                            <small>Data · Business</small>
                          </span>
                          <span className="st n">To explore</span>
                        </div>
                        <div className="it">
                          <span>
                            Physiotherapist
                            <br />
                            <small>Health · Care</small>
                          </span>
                          <span className="st n">To explore</span>
                        </div>
                      </div>
                      <div className="box">
                        <h4>Next steps</h4>
                        <div className="ck done">
                          <i aria-hidden="true">✓</i>
                          <span>Complete strengths reflection</span>
                        </div>
                        <div className="ck">
                          <i />
                          <span>Compare UX Designer and Data Analyst</span>
                        </div>
                        <div className="ck">
                          <i />
                          <span>Look at design programmes abroad</span>
                        </div>
                        <div className="ck">
                          <i />
                          <span>Book a discovery session</span>
                        </div>
                      </div>
                      <Link className="strip s-span" href={V4_ROUTES.bookSession} style={{ background: "var(--f5)", color: "var(--f1)" }}>
                        <span>Your first discovery conversation is free.</span>
                        <b>Choose a time →</b>
                      </Link>
                    </div>
                    <div className="panel s-grid" role="tabpanel" aria-label="Abroad workspace" data-pn="studio" data-key="abroad">
                      <div className="box">
                        <h4>Shortlist</h4>
                        <div className="it">
                          <span>
                            Data Science · Master&apos;s
                            <br />
                            <small>Netherlands</small>
                          </span>
                          <span className="st b">Requirements to check</span>
                        </div>
                        <div className="it">
                          <span>
                            Sustainable Energy · Master&apos;s
                            <br />
                            <small>Sweden</small>
                          </span>
                          <span className="st n">Saved</span>
                        </div>
                        <div className="it">
                          <span>
                            Computer Science · Bachelor&apos;s
                            <br />
                            <small>Ireland</small>
                          </span>
                          <span className="st n">Saved</span>
                        </div>
                      </div>
                      <div className="box">
                        <h4>Application checklist</h4>
                        <div className="ck done">
                          <i aria-hidden="true">✓</i>
                          <span>Request school transcripts</span>
                        </div>
                        <div className="ck">
                          <i />
                          <span>Check English test requirement</span>
                        </div>
                        <div className="ck">
                          <i />
                          <span>Draft motivation letter</span>
                        </div>
                        <div className="ck">
                          <i />
                          <span>Confirm deadline on the official page</span>
                        </div>
                      </div>
                      <Link className="strip s-span" href={V4_ROUTES.saveToStudio} style={{ background: "var(--b5)", color: "var(--b1)" }}>
                        <span>Share your shortlist with a parent or guardian.</span>
                        <b>Invite →</b>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 06 TRUST & GUIDANCE */}
            <section className="nw4-layer L5" id="nw4-scene-5" aria-label="Trust and guidance">
              <div className="a eb t-eb" data-sec="5" data-i="0">
                How we guide you
              </div>
              <p className="a serif t-st center fill" data-sec="5" data-i="0">
                {words.map((w, i) => (
                  <span key={i}>
                    <span className="w" data-nw4-word="">
                      {w}
                    </span>
                    {i < words.length - 1 ? " " : null}
                  </span>
                ))}
              </p>
              <div className="a t-pillars" data-sec="5" data-i="2">
                {V4_PILLARS.map((p, i) => (
                  <div className="pillar" key={p.title}>
                    <span className="ix">{String(i + 1).padStart(2, "0")}</span>
                    <b>{p.title}</b>
                    <span>{p.body}</span>
                  </div>
                ))}
              </div>
              <div className="a t-free" data-sec="5" data-i="3">
                <span className="pill-free">
                  <i style={{ width: 7, height: 7, borderRadius: "50%", background: "#A7B7A1" }} />
                  Your first discovery conversation is free
                </span>
                <Link className="tl" href={V4_ROUTES.howItWorks} style={{ color: "var(--t3)", fontSize: 14 }}>
                  How guidance works <Arrow />
                </Link>
              </div>
            </section>

            {/* 07 FINAL CONVERSION */}
            <section className="nw4-layer L6" id="nw4-scene-6" aria-label="Start exploring">
              <div className="a ph f-photo" style={{ background: "none" }}>
                <i>
                  <V4Picture
                    image={finalBg}
                    sizes={desktopSizes(coverWidth(1526, 954, finalBg))}
                    mobileSizes={mobileSizes(coverWidth(413, 895, finalBg))}
                    alt=""
                    objectPosition="50% 40%"
                  />
                </i>
              </div>
              <h2 className="a serif f-h2 center" data-sec="6" data-i="0">
                <span className="ln">
                  <span>Your next step</span>
                </span>
                <span className="ln">
                  <span>
                    <em style={{ color: "var(--p4)" }}>starts here.</em>
                  </span>
                </span>
              </h2>
              <p className="a body f-sub center" data-sec="6" data-i="1">
                Explore on your own, or begin with a free conversation with an adviser.
              </p>
              <div className="a f-cta" data-sec="6" data-i="2">
                <div className="ctas">
                  <Link className="btn light" href={V4_ROUTES.careers}>
                    Start Exploring <Arrow />
                  </Link>
                  <Link className="btn ghost" href={V4_ROUTES.bookSession}>
                    Book a Free Discovery Session <Arrow />
                  </Link>
                </div>
              </div>
              <div className="a f-acc" data-sec="6" data-i="3">
                <Link className="tl" href={V4_ROUTES.register} style={{ color: "var(--p4)" }}>
                  Create a Free Account <Arrow />
                </Link>
              </div>
              <div className="a f-foot" data-sec="6" data-i="3">
                <span>© 2026 NextWise</span>
                <span style={{ display: "flex", gap: 22 }}>
                  <Link href={V4_ROUTES.privacy}>Privacy</Link>
                  <Link href={V4_ROUTES.terms}>Terms</Link>
                  <Link href={V4_ROUTES.contact}>Contact</Link>
                </span>
              </div>
            </section>

            {/* the official N (one element, all scenes) */}
            <div className="nmark" data-nw4-n="" role="img" aria-label="NextWise N">
              <svg width="512" height="512" viewBox="0 0 512 512" aria-hidden="true">
                <defs>
                  <filter id="nw4-fe" filterUnits="userSpaceOnUse" x="-120" y="-120" width="752" height="752">
                    <feGaussianBlur data-nw4-n-blur="" stdDeviation="16" />
                  </filter>
                  <mask id="nw4-nm" maskUnits="userSpaceOnUse" x="-120" y="-120" width="752" height="752">
                    <path
                      data-nw4-n-path=""
                      filter="url(#nw4-fe)"
                      d="M 52 420 C 95 345, 120 255, 165 215 C 200 185, 240 195, 262 240 C 288 292, 300 345, 330 362 C 352 374, 372 330, 392 285 L 452 108"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="150"
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray="1 1"
                    />
                    <rect data-nw4-n-full="" x="-20" y="-20" width="552" height="552" fill="#fff" opacity="0" />
                  </mask>
                  <mask id="nw4-na" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512" style={{ maskType: "alpha" }}>
                    <image href={BRAND_LOGO.icon} width="512" height="512" />
                  </mask>
                  <linearGradient id="nw4-sh" x1="0" x2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g mask="url(#nw4-nm)">
                  <image href={BRAND_LOGO.icon} width="512" height="512" />
                </g>
                <g mask="url(#nw4-na)">
                  <rect data-nw4-n-sheen="" x="-200" y="-120" width="170" height="760" fill="url(#nw4-sh)" transform="rotate(18 256 256)" opacity="0" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>

      </V54AccountProvider>
      <noscript>
        <style>{`.nw4 .nw4-stage{visibility:visible!important}.nw4 .nw4-layer:not(.L0),.nw4 .nmark{display:none!important}body:has(.nw54)>header{display:none!important}.v54-thoughts{display:none!important}`}</style>
      </noscript>
    </div>
  );
}
