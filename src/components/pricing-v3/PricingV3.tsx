"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, Check, ChevronDown, Info, Minus, Plus, ShieldCheck, X } from "lucide-react";
import { quotePackage, type PackageQuoteResponse } from "@/app/(site)/pricing/actions";
import type { V3PublicPlan } from "@/lib/pricing/v3/catalogue";
import { V3_COMPARISON, V3_FAQS, V3_SCOPE, V3_STAGE, type CompareCell } from "@/lib/pricing/v3/content";
import { V3_PLAN_SLUGS, computePackageQuote, formatInr, maxAdditional, type PackageQuote, type V3PlanSlug } from "@/lib/pricing/v3/quote";

type Extras = Record<V3PlanSlug, number>;
const STORE_KEY = "nw-pricing-v3-selection";

interface PricingV3Props {
  plans: V3PublicPlan[];
  signedIn: boolean;
  purchasesOpen: boolean;
  initialPlan: V3PlanSlug | null;
  initialExtra: number;
}

function quoteFor(plan: V3PublicPlan, extra: number): PackageQuote | null {
  const r = computePackageQuote({ baseAmountMinorUnits: plan.amountMinorUnits, currency: plan.currency, addon: plan.universityAddon, additionalUniversities: extra });
  return r.ok ? r.quote : null;
}

/**
 * NW-PRICING-V3 — the three-plan pricing experience.
 *
 * Every price and add-on term comes from props, which the server reads from
 * the published catalogue. Totals shown while the student changes the number
 * of universities are computed with the same function the server uses, and the
 * server re-checks the chosen package (quotePackage) before it is shown as
 * confirmed or saved. Nothing here can charge, create an invoice or grant
 * access.
 */
export function PricingV3({ plans, signedIn, purchasesOpen, initialPlan, initialExtra }: PricingV3Props) {
  const bySlug = useMemo(() => new Map(plans.map((p) => [p.slug, p])), [plans]);
  const [selected, setSelected] = useState<V3PlanSlug | null>(initialPlan);
  const [extras, setExtras] = useState<Extras>(() => ({
    "nextwise-verified": 0,
    "study-abroad-lite": initialPlan === V3_PLAN_SLUGS.lite ? initialExtra : 0,
    "study-abroad-premium": initialPlan === V3_PLAN_SLUGS.premium ? initialExtra : 0,
  }));
  const [check, setCheck] = useState<{ key: string; res: PackageQuoteResponse } | null>(null);
  const [saveResult, setSaveResult] = useState<{ key: string; res: PackageQuoteResponse } | null>(null);
  const [saving, startSave] = useTransition();
  const [barVisible, setBarVisible] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);

  const plan = selected ? bySlug.get(selected) ?? null : null;
  const extra = selected ? extras[selected] : 0;
  const key = selected ? `${selected}:${extra}` : "";
  const localQuote = plan ? quoteFor(plan, extra) : null;

  // keep the choice in the address (survives sign-in through ?next=) and in this tab
  useEffect(() => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("plan", selected);
    if (extra > 0) url.searchParams.set("extra", String(extra));
    else url.searchParams.delete("extra");
    window.history.replaceState(window.history.state, "", url.toString());
    try {
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ plan: selected, extra }));
    } catch {
      /* optional */
    }
  }, [selected, extra]);

  // the server prices the chosen package again from the published catalogue
  useEffect(() => {
    if (!selected) return;
    let live = true;
    const t = window.setTimeout(() => {
      quotePackage(selected, extra, false)
        .then((res) => live && setCheck({ key: `${selected}:${extra}`, res }))
        .catch(() => live && setCheck({ key: `${selected}:${extra}`, res: { status: "invalid", message: "We couldn't check this price just now." } }));
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [selected, extra]);

  useEffect(() => {
    const onScroll = () => {
      const s = summaryRef.current;
      if (!s || !selected) return setBarVisible(false);
      const r = s.getBoundingClientRect();
      setBarVisible(r.top > window.innerHeight || r.bottom < 0);
    };
    const first = window.requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(first);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [selected]);

  const choose = (slug: V3PlanSlug, scroll: boolean) => {
    setSelected(slug);
    if (scroll) window.setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 60);
  };
  const changeExtra = useCallback(
    (slug: V3PlanSlug, delta: number) => {
      const p = bySlug.get(slug);
      if (!p?.universityAddon) return;
      setExtras((prev) => ({ ...prev, [slug]: Math.max(0, Math.min(maxAdditional(p.universityAddon), prev[slug] + delta)) }));
      setSelected(slug);
    },
    [bySlug],
  );

  const save = () => {
    if (!selected) return;
    const k = key;
    startSave(async () => {
      const res = await quotePackage(selected, extra, true);
      setSaveResult({ key: k, res });
    });
  };

  const confirmed = check && check.key === key ? check.res : null;
  const saved = saveResult && saveResult.key === key ? saveResult.res : null;
  const nextHref = selected ? `/pricing?plan=${selected}${extra > 0 ? `&extra=${extra}` : ""}#your-package` : "/pricing";
  const checkoutAllowed = purchasesOpen && extra === 0;

  return (
    <div className="pv3-body">
      <section className="pv3-cards wrap" aria-label="Packages">
        {plans.map((p, i) => (
          <PlanCard
            key={p.slug}
            plan={p}
            index={i}
            selected={selected === p.slug}
            extra={extras[p.slug]}
            onChange={(d) => changeExtra(p.slug, d)}
            onChoose={() => choose(p.slug, true)}
          />
        ))}
      </section>

      <section id="your-package" ref={summaryRef} className="pv3-summary wrap" aria-labelledby="pv3-summary-title">
        <div className="pv3-summary-card" data-empty={plan ? undefined : ""}>
          <div className="pv3-summary-head">
            <h2 id="pv3-summary-title" className="display">
              Your package
            </h2>
            {plan ? <p>Check the breakdown, then choose how to continue. Nothing is charged on this page.</p> : <p>Choose a package above to see its full breakdown here.</p>}
          </div>
          {plan && localQuote ? (
            <div className="pv3-summary-grid">
              <dl className="pv3-breakdown" aria-live="polite">
                <div>
                  <dt>Package</dt>
                  <dd>{plan.name}</dd>
                </div>
                <div>
                  <dt>Base price</dt>
                  <dd>{formatInr(localQuote.baseAmountMinorUnits)}</dd>
                </div>
                {localQuote.includedUniversities !== null ? (
                  <>
                    <div>
                      <dt>Universities included</dt>
                      <dd>{localQuote.includedUniversities}</dd>
                    </div>
                    <div>
                      <dt>Additional universities</dt>
                      <dd>
                        <Num value={localQuote.additionalUniversities} /> × {formatInr(localQuote.addonUnitAmountMinorUnits ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt>Additional universities amount</dt>
                      <dd>
                        <Num value={formatInr(localQuote.addonAmountMinorUnits)} />
                      </dd>
                    </div>
                    <div className="pv3-cover">
                      <dt>University coverage</dt>
                      <dd>
                        <Num value={localQuote.totalUniversities ?? 0} /> universities
                      </dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt>University applications</dt>
                    <dd>Not part of Verified</dd>
                  </div>
                )}
                <div className="pv3-total">
                  <dt>Package total</dt>
                  <dd>
                    <Num value={formatInr(localQuote.totalAmountMinorUnits)} />
                  </dd>
                </div>
              </dl>
              <div className="pv3-next">
                <p className="pv3-tax">
                  {plan.taxStatus === "tax_inclusive" || plan.slug === V3_PLAN_SLUGS.verified
                    ? "Final price, GST included."
                    : "Package price. Any GST that applies is confirmed in your agreement before you pay; nothing is added on this page."}
                </p>
                <p className="pv3-check" role="status">
                  {confirmed?.status === "ok" && confirmed.quote.totalAmountMinorUnits === localQuote.totalAmountMinorUnits ? (
                    <>
                      <ShieldCheck className="icon" aria-hidden="true" /> Price confirmed by Nextwise from the current catalogue.
                    </>
                  ) : confirmed?.status === "invalid" ? (
                    <>
                      <Info className="icon" aria-hidden="true" /> {confirmed.message}
                    </>
                  ) : (
                    <span className="pv3-checking">Confirming the price…</span>
                  )}
                </p>
                {checkoutAllowed ? (
                  <Link className="btn btn-primary" href={`/pricing/checkout/${plan.slug}`}>
                    Continue to secure checkout <ArrowRight className="icon" aria-hidden="true" />
                  </Link>
                ) : (
                  <Link className="btn btn-primary" href="/book-counselling" id="pv3-continue">
                    Continue with a Nextwise counsellor <ArrowRight className="icon" aria-hidden="true" />
                  </Link>
                )}
                {signedIn ? (
                  <button type="button" className="btn btn-quiet" onClick={save} disabled={saving} id="pv3-save">
                    {saving ? "Saving…" : "Save this package to my account"}
                  </button>
                ) : (
                  <Link className="btn btn-quiet" href={`/login?next=${encodeURIComponent(nextHref)}`} id="pv3-signin">
                    Sign in to save this package
                  </Link>
                )}
                {saved ? (
                  <p className="pv3-saved" role="status">
                    {saved.status === "ok" && saved.saved === "account" ? (
                      <>
                        <Check className="icon" aria-hidden="true" /> Saved to your account. Your counsellor will see exactly this package.
                      </>
                    ) : saved.status === "ok" ? (
                      "We couldn't save it just now. Your choice is still kept on this page."
                    ) : (
                      saved.message
                    )}
                  </p>
                ) : null}
                <p className="pv3-note">
                  {purchasesOpen
                    ? extra > 0
                      ? "Packages with additional universities are confirmed with a counsellor before payment."
                      : "You review the order before anything is charged."
                    : "Online payment isn't open yet, so nothing can be charged here. A counsellor confirms your package and agreement first."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <Comparison plans={plans} />

      <section className="pv3-scope wrap" aria-labelledby="pv3-scope-title">
        <h2 id="pv3-scope-title" className="display">
          What we promise, and what we don’t
        </h2>
        <ul>
          {V3_SCOPE.map((s) => (
            <li key={s.title}>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pv3-faq wrap" aria-labelledby="pv3-faq-title">
        <h2 id="pv3-faq-title" className="display">
          Questions
        </h2>
        <div className="pv3-faq-list">
          {V3_FAQS.map((f) => (
            <details key={f.question}>
              <summary>
                {f.question}
                <ChevronDown className="icon" aria-hidden="true" />
              </summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {plan && localQuote ? (
        <div className={`pv3-bar ${barVisible ? "show" : ""}`} aria-hidden={!barVisible}>
          <span className="pv3-bar-text">
            <b>{plan.name}</b>
            <span>
              {localQuote.totalUniversities !== null ? `${localQuote.totalUniversities} universities · ` : ""}
              <Num value={formatInr(localQuote.totalAmountMinorUnits)} />
            </span>
          </span>
          <a className="btn btn-primary" href="#your-package" tabIndex={barVisible ? 0 : -1}>
            Review package
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** A number that rolls in when it changes (motion only, the value is always the text). */
function Num({ value }: { value: string | number }) {
  return (
    <span className="pv3-num" key={String(value)}>
      {value}
    </span>
  );
}

function PlanCard({
  plan,
  index,
  selected,
  extra,
  onChange,
  onChoose,
}: {
  plan: V3PublicPlan;
  index: number;
  selected: boolean;
  extra: number;
  onChange: (delta: number) => void;
  onChoose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const q = quoteFor(plan, extra);
  const addon = plan.universityAddon;
  const highlights = plan.inclusions.filter((i) => i.highlight).slice(0, 5);
  const groups = plan.inclusions.reduce<Map<string, string[]>>((m, i) => m.set(i.group, [...(m.get(i.group) ?? []), i.title]), new Map());
  const isVerified = plan.slug === V3_PLAN_SLUGS.verified;
  const limit = maxAdditional(addon);
  const titleId = `pv3-${plan.slug}`;

  return (
    <article className="pv3-card" data-selected={selected ? "" : undefined} data-plan={plan.slug} style={{ animationDelay: `${0.08 + index * 0.09}s` }} aria-labelledby={titleId}>
      {plan.slug === V3_PLAN_SLUGS.premium ? <span className="pv3-flag">Most complete</span> : null}
      <span className="pv3-stage">
        <span className="pv3-stage-n">{index + 1}</span>
        {V3_STAGE[plan.slug].stage}
      </span>
      <h2 id={titleId} className="display">
        {plan.name}
      </h2>
      <p className="pv3-desc">{plan.description}</p>

      <div className="pv3-price">
        <b>
          <Num value={formatInr(q?.totalAmountMinorUnits ?? plan.amountMinorUnits)} />
        </b>
        <span>{isVerified ? "final price, GST included" : extra > 0 ? `${formatInr(plan.amountMinorUnits)} package + ${extra} more` : "package price, one-time"}</span>
      </div>

      {addon && q ? (
        <div className="pv3-unis" role="group" aria-label={`Universities for ${plan.name}`}>
          <div className="pv3-dots" aria-hidden="true">
            {Array.from({ length: addon.includedQuantity }).map((_, i) => (
              <i key={`in-${i}`} />
            ))}
            {Array.from({ length: extra }).map((_, i) => (
              <i key={`add-${i}`} data-added="" />
            ))}
          </div>
          <div className="pv3-unis-row">
            <span className="pv3-unis-label">
              <b>
                <Num value={q.totalUniversities ?? addon.includedQuantity} /> universities
              </b>
              <span>
                {addon.includedQuantity} included{extra > 0 ? ` + ${extra} additional` : ""}
              </span>
            </span>
            <span className="pv3-stepper">
              <button type="button" onClick={() => onChange(-1)} disabled={extra === 0} aria-label={`Remove one additional university from ${plan.name}`}>
                <Minus className="icon" aria-hidden="true" />
              </button>
              <output aria-live="polite" aria-label="Additional universities">
                {extra}
              </output>
              <button type="button" onClick={() => onChange(1)} disabled={extra >= limit} aria-label={`Add one university to ${plan.name}`}>
                <Plus className="icon" aria-hidden="true" />
              </button>
            </span>
          </div>
          <span className="pv3-unit">Each additional university {formatInr(addon.unitAmountMinorUnits)}</span>
        </div>
      ) : (
        <div className="pv3-unis pv3-unis-none">
          <span className="pv3-unis-label">
            <b>Guidance, not applications</b>
            <span>Up to three researched programme recommendations</span>
          </span>
        </div>
      )}

      <ul className="pv3-hl">
        {highlights.map((h) => (
          <li key={h.title}>
            <Check className="icon" aria-hidden="true" />
            <span>{h.title}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="pv3-more" aria-expanded={open} aria-controls={`${titleId}-all`} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide the full list" : "See everything included"}
        <ChevronDown className="icon" aria-hidden="true" />
      </button>
      <div className="pv3-all" id={`${titleId}-all`} hidden={!open}>
        {[...groups.entries()].map(([group, items]) => (
          <div key={group}>
            <h3>{group}</h3>
            <ul>
              {items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="pv3-act">
        <button type="button" className={`btn ${selected ? "btn-primary" : "btn-quiet"}`} onClick={onChoose} id={`pv3-choose-${plan.slug}`} aria-pressed={selected}>
          {selected ? "Selected" : (plan.ctaText ?? `Choose ${plan.name}`)} {selected ? <Check className="icon" aria-hidden="true" /> : <ArrowRight className="icon" aria-hidden="true" />}
        </button>
      </div>
    </article>
  );
}

function Cell({ v }: { v: CompareCell }) {
  if (v === true)
    return (
      <span className="pv3-yes">
        <Check className="icon" aria-label="Included" />
      </span>
    );
  if (v === false)
    return (
      <span className="pv3-no">
        <X className="icon" aria-label="Not included" />
      </span>
    );
  return <span className="pv3-val">{v}</span>;
}

function Comparison({ plans }: { plans: V3PublicPlan[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="pv3-compare wrap" aria-labelledby="pv3-compare-title">
      <div className="pv3-compare-head">
        <h2 id="pv3-compare-title" className="display">
          Compare the three packages
        </h2>
        <button type="button" className="btn btn-quiet" aria-expanded={open} aria-controls="pv3-compare-table" onClick={() => setOpen((o) => !o)} id="pv3-compare-toggle">
          {open ? "Hide the detailed comparison" : "Open the detailed comparison"} <ChevronDown className="icon" aria-hidden="true" />
        </button>
      </div>
      {open ? <p className="pv3-swipe">Swipe the table sideways to see all three packages.</p> : null}
      <div className="pv3-table-wrap" id="pv3-compare-table" hidden={!open} tabIndex={0} role="region" aria-label="Detailed comparison table">
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr">Service</span>
              </th>
              {plans.map((p) => (
                <th scope="col" key={p.slug}>
                  {p.name.replace("Nextwise ", "")}
                </th>
              ))}
            </tr>
          </thead>
          {V3_COMPARISON.map((g) => (
            <tbody key={g.title}>
              <tr className="pv3-group">
                <th scope="colgroup" colSpan={plans.length + 1}>
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">
                    {r.label}
                    {r.note ? <small>{r.note}</small> : null}
                  </th>
                  {plans.map((p) => (
                    <td key={p.slug}>
                      <Cell v={r.cells[p.slug]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
