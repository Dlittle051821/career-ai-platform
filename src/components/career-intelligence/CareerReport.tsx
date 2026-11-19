"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowRight, BarChart3, Check, Compass, GraduationCap, Layers, Route, Target } from "lucide-react";
import { SaveCareerButton } from "@/components/career-explorer/SaveCareerButton";

export type BandTone = "strong" | "promising" | "explore";

export interface ReportItem {
  careerId: string;
  slug: string;
  title: string;
  familyName: string;
  summary: string;
  band: { label: string; tone: BandTone };
  reasons: string[];
  strengths: string[];
  gaps: string[];
  routes: { title: string; detail: string }[];
  nextSteps: { text: string; href: string | null }[];
  image: { src: string; alt: string; credit: string } | null;
  saved: boolean;
}

/** The unlocked report: the recommendation list and the selected career's detail. Only rendered after the server has confirmed access. */
export function CareerReport({ items }: { items: ReportItem[] }) {
  const [selected, setSelected] = useState(0);
  const item = items[selected];

  const select = (i: number) => {
    setSelected(i);
    if (window.matchMedia("(max-width: 1060px)").matches) document.getElementById("ci-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="report">
      <div className="wrap rep-grid">
        <nav className="rlist" aria-label="Your recommendations">
          <h2>Your recommendations</h2>
          {items.map((x, i) => (
            <button key={x.careerId} type="button" className="ritem" aria-current={i === selected ? "true" : undefined} onClick={() => select(i)} style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
              {x.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.image.src} alt="" />
              ) : (
                <span className="tile" aria-hidden="true">
                  <Compass className="icon" />
                </span>
              )}
              <span>
                <b>
                  {i + 1}. {x.title}
                </b>
                <span className={`band ${x.band.tone}`}>{x.band.label}</span>
              </span>
            </button>
          ))}
          <p className="count-line">Fit levels use Career Intelligence’s own labels; no percentages are shown.</p>
        </nav>

        <article className="detail" aria-labelledby="ci-detail-title" id="ci-detail" key={item.careerId}>
          <div className="ph">
            {item.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image.src} alt={item.image.alt} />
                <span className="credit">{item.image.credit}</span>
              </>
            ) : (
              <span className="tile">
                <Compass className="icon" aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="bd">
            <span className={`band ${item.band.tone}`}>{item.band.label}</span>
            <h2 id="ci-detail-title" className="display">
              {item.title}
            </h2>
            <p style={{ color: "var(--muted)", margin: "8px 0 0" }}>
              {item.familyName} · {item.summary}
            </p>

            {item.reasons.length > 0 ? (
              <div className="dsec">
                <h3>
                  <Target className="icon" aria-hidden="true" /> Why this fits you
                </h3>
                <ul>
                  {item.reasons.map((r) => (
                    <li key={r}>
                      <Check className="icon" aria-hidden="true" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {item.strengths.length > 0 ? (
              <div className="dsec">
                <h3>
                  <BarChart3 className="icon" aria-hidden="true" /> Strengths you bring
                </h3>
                <div className="chips">
                  {item.strengths.map((s) => (
                    <span className="chip" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {item.gaps.length > 0 ? (
              <div className="dsec">
                <h3>
                  <Layers className="icon" aria-hidden="true" /> Worth developing
                </h3>
                <ul>
                  {item.gaps.map((g) => (
                    <li className="gap" key={g}>
                      <AlertCircle className="icon" aria-hidden="true" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {item.routes.length > 0 ? (
              <div className="dsec">
                <h3>
                  <GraduationCap className="icon" aria-hidden="true" /> Education pathway
                </h3>
                <div className="path">
                  {item.routes.map((r) => (
                    <div key={`${r.title}-${r.detail}`}>
                      <b>{r.title}</b>
                      <span>{r.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="dsec">
              <h3>
                <Route className="icon" aria-hidden="true" /> Your next steps
              </h3>
              <ul className="steps3">
                {item.nextSteps.map((s) => (
                  <li key={s.text}>
                    <span>{s.href ? <Link href={s.href}>{s.text}</Link> : s.text}</span>
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
                <Link className="btn btn-primary" href="/studio">
                  Go to Student Studio <ArrowRight className="icon" aria-hidden="true" />
                </Link>
                <span className="ce">
                  <SaveCareerButton careerId={item.careerId} slug={item.slug} title={item.title} initialSaved={item.saved} inline />
                </span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
